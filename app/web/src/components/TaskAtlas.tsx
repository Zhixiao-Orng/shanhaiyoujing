import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ReactFlow, Background, MiniMap, PanOnScrollMode, useNodesState, type Node, type Edge, type ReactFlowInstance, type OnNodeDrag } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createPortal } from 'react-dom';
import type { Task, TaskStatus } from '../types';
import './TaskAtlas.css';
import {IdeaPool, ideaDragType} from './IdeaPool';
const names: Record<TaskStatus,string> = {backlog:'待安排',todo:'待办',in_progress:'进行中',in_review:'待验收',blocked:'受阻',done:'已完成',canceled:'已取消'};
const colors: Record<TaskStatus,string> = {backlog:'#8996a8',todo:'#8996a8',in_progress:'#488cff',in_review:'#bd8bfa',blocked:'#e7a449',done:'#49ac8b',canceled:'#777'};
function order(t:Task){const tag=t.labels.find(x=>x.startsWith('atlas-order:'));return tag?Number(tag.split(':')[1]):Number(t.title.match(/^\d+/)?.[0] || 100000);}
function stateTitle(title:string){const match=title.match(/^(\d+)[.、]\s*(.+)$/);if(!match)return title;const numerals=['零','一','二','三','四','五','六','七','八','九','十'];return `第${numerals[Number(match[1])] || match[1]}个任务：${match[2]}`;}
function restore(key:string) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function NodeStatus({task,onStatus}:{task:Task;onStatus:(task:Task,status:TaskStatus)=>Promise<unknown>}) {
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 return <><select className="atlas-node-status nodrag nowheel" aria-label={`修改 ${task.title} 的状态`} value={task.status} disabled={saving} style={{color:colors[task.status]}} onClick={e=>e.stopPropagation()} onChange={async e=>{
  const value=e.target.value as TaskStatus;
  setSaving(true);setError('');
  try { await onStatus(task,value); } catch(cause) { setError(cause instanceof Error?cause.message:String(cause)); } finally {setSaving(false);}
 }}>{Object.entries(names).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{error&&<span className="atlas-node-status-error" role="alert">{error}</span>}</>;
}
function DependencyBadge({title, prerequisites, dependents}:{title:string; prerequisites:string[]; dependents:string[]}) {
 const [anchor,setAnchor]=useState<{left:number;top:number;above:boolean}|null>(null);
 function show(element:HTMLButtonElement){
  const rect=element.getBoundingClientRect();
  setAnchor({left:Math.max(8,Math.min(rect.left,window.innerWidth-308)),top:rect.top,above:rect.top>window.innerHeight/2});
 }
 return <>
  <button className="atlas-dependency-badge nodrag" aria-label={`查看 ${title} 的依赖关系`} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setAnchor(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setAnchor(null)} onKeyDown={e=>{if(e.key==='Escape')setAnchor(null);}} onClick={e=>e.stopPropagation()}>
   {prerequisites.length>0?`前置 ${prerequisites.length}`:''}{prerequisites.length>0&&dependents.length>0?' · ':''}{dependents.length>0?`后续 ${dependents.length}`:''}
  </button>
  {anchor&&createPortal(<div role="tooltip" className="atlas-dependency-tooltip" style={{left:anchor.left,...(anchor.above?{bottom:window.innerHeight-anchor.top+8}:{top:anchor.top+30})}}>
   {prerequisites.length>0&&<section><strong>前置 · 需要先完成</strong>{prerequisites.map((name,i)=><div key={i}>{name}</div>)}</section>}
   {dependents.length>0&&<section><strong>后续 · 完成后可推进</strong>{dependents.map((name,i)=><div key={i}>{name}</div>)}</section>}
  </div>,document.body)}
 </>;
}
export function TaskAtlas({tasks,projectId,onOpen,onStatus,onCreateIdea,onPromoteIdea}:{tasks:Task[];projectId:string;onOpen:(t:Task)=>void;onStatus:(t:Task,s:TaskStatus)=>Promise<unknown>;onCreateIdea:(title:string,description:string)=>Promise<unknown>;onPromoteIdea:(idea:Task,parent:Task|null,order:number)=>Promise<unknown>}) {
 const storageKey = `task-atlas.${projectId}`;
 const [saved] = useState(()=>restore(storageKey));
 const [collapsed,setCollapsed] = useState<string[]>(saved.collapsed || []);
 const [focus,setFocus] = useState<string>(saved.focus || '');
 const [goalId,setGoalId] = useState<string>(saved.goalId || '');
 const [flow,setFlow] = useState<ReactFlowInstance<Node,Edge>|null>(null);
 const canvasRef=useRef<HTMLDivElement>(null);
 const [stagedIdeaId,setStagedIdeaId]=useState<string|null>(null);
 const [stagedPosition,setStagedPosition]=useState({x:80,y:80});
 const [hoverTargetId,setHoverTargetId]=useState<string|null>(null);
 const [placing,setPlacing]=useState(false);
 const [placementError,setPlacementError]=useState('');
 const [placementNotice,setPlacementNotice]=useState('');
 const [nodes,setNodes,onNodesChange]=useNodesState<Node>([]);
 const [pending,setPending] = useState(false);
 const [error,setError] = useState('');
 const active = tasks.filter(t=>!t.archivedAt && !t.labels.includes('想法池'));
 const byId = new Map(active.map(t=>[t.id,t]));
 const stagedIdea=tasks.find(t=>t.id===stagedIdeaId && t.labels.includes('想法池'));
 const roots = active.filter(t=>!t.relations.parent || !byId.has(t.relations.parent.id));
 const goal = roots.find(t=>t.id===goalId) || roots[0];
 const children = (id:string) => active.filter(t=>t.relations.parent?.id===id).sort((a,b)=>order(a)-order(b) || a.createdAt.localeCompare(b.createdAt));
 const members = new Set<string>();
 function collect(id:string) { if(members.has(id))return; members.add(id); children(id).forEach(t=>collect(t.id)); }
 if(goal)collect(goal.id);
 const scoped = active.filter(t=>members.has(t.id));
 const current = scoped.find(t=>t.id===focus) || scoped.find(t=>t.id!==goal?.id && t.status==='in_progress') || goal;
 const path:Task[]=[]; let cursor:Task|undefined=current;
 while(cursor && !path.some(t=>t.id===cursor!.id)){path.unshift(cursor);cursor=byId.get(cursor.relations.parent?.id || '');}
 const stages=goal?children(goal.id):[];
 const leaves=scoped.filter(t=>!children(t.id).length && t.id!==goal?.id && t.status!=='canceled');
 const finished=leaves.filter(t=>t.status==='done').length;
 function persist(f=focus,c=collapsed,g=goalId){localStorage.setItem(storageKey,JSON.stringify({focus:f,collapsed:c,goalId:g}));}
 function choose(id:string){setFocus(id);persist(id);}
 function toggle(id:string){const c=collapsed.includes(id)?collapsed.filter(x=>x!==id):[...collapsed,id];setCollapsed(c);persist(focus,c);}
 async function promoteIdea(idea:Task,parentId:string|null){
  const parent=parentId?byId.get(parentId):null;
  if(parentId&&!parent)throw new Error('所选任务已不存在，请重新选择位置。');
  const nextOrder=parent?Math.max(0,...children(parent.id).map(order))+1:0;
  await onPromoteIdea(idea,parent||null,nextOrder);
  const ancestors:string[]=[];let cursor=parent;
  while(cursor&&!ancestors.includes(cursor.id)){ancestors.push(cursor.id);cursor=byId.get(cursor.relations.parent?.id||'');}
  const destinationGoal=ancestors.length?ancestors[ancestors.length-1]:idea.id;
  const nextCollapsed=collapsed.filter(id=>!ancestors.includes(id));
  setCollapsed(nextCollapsed);setGoalId(destinationGoal);setFocus(idea.id);persist(idea.id,nextCollapsed,destinationGoal);
 }
 function stageIdea(idea:Task,point?:{x:number;y:number}){
  const rect=canvasRef.current?.getBoundingClientRect();
  const center=point || (rect?{x:rect.left+rect.width/2,y:rect.top+75}:{x:160,y:160});
  const position=flow?.screenToFlowPosition(center) || {x:80,y:80};
  setStagedIdeaId(idea.id);setStagedPosition({x:position.x-142,y:position.y-45});setHoverTargetId(null);setPlacementError('');setPlacementNotice('');
  canvasRef.current?.scrollIntoView({behavior:'instant',block:'center'});
 }
 function targetAt(x:number,y:number,excludeId?:string){
  if(!flow)return null;
  const point=flow.screenToFlowPosition({x,y});
  for(const node of flow.getNodes()){
   if(node.id===excludeId||!members.has(node.id))continue;
   let ancestor=byId.get(node.id);
   while(ancestor&&ancestor.id!==excludeId)ancestor=byId.get(ancestor.relations.parent?.id||'');
   if(excludeId&&ancestor?.id===excludeId)continue;
   const width=node.measured?.width||node.width||285;
   const height=node.measured?.height||node.height||110;
   if(point.x>=node.position.x&&point.x<=node.position.x+width&&point.y>=node.position.y&&point.y<=node.position.y+height)return node.id;
  }
  return null;
 }
 async function placeIdea(idea:Task,parentId:string|null){
  if(placing)return;
  setPlacing(true);setPlacementError('');setPlacementNotice('');
  try{await promoteIdea(idea,parentId);if(stagedIdeaId===idea.id)setStagedIdeaId(null);setHoverTargetId(null);setPlacementNotice(parentId?`“${idea.title}”已放入“${byId.get(parentId)?.title}”下面。`:`“${idea.title}”已设为独立总目标。`);}
  catch(cause){setPlacementError(cause instanceof Error?cause.message:String(cause));}
  finally{setPlacing(false);}
 }
 const dragNode:OnNodeDrag=(event,node)=>{
  if(placing)return;
  const point='clientX' in event?event:event.changedTouches[0];
  if(point)setHoverTargetId(targetAt(point.clientX,point.clientY,node.id));
 };
 const finishNodeDrag:OnNodeDrag=(event,node)=>{
  const task=tasks.find(t=>t.id===node.id);
  if(!task)return;
  const point='clientX' in event?event:event.changedTouches[0];
  const target=point?targetAt(point.clientX,point.clientY,node.id):null;
  setHoverTargetId(null);
  if(node.id===stagedIdeaId)setStagedPosition(node.position);
  if(target&&target!==task.relations.parent?.id)void placeIdea(task,target);
  else if(node.id!==stagedIdeaId)setNodes(previous=>previous.map(n=>n.id===node.id?{...n,position:layoutNodes.find(original=>original.id===n.id)?.position||n.position}:n));
 };
 function onCanvasDragOver(event:DragEvent<HTMLDivElement>){
  if(!event.dataTransfer.types.includes(ideaDragType))return;
  event.preventDefault();event.dataTransfer.dropEffect='move';setHoverTargetId(targetAt(event.clientX,event.clientY));
 }
 function onCanvasDrop(event:DragEvent<HTMLDivElement>){
  const id=event.dataTransfer.getData(ideaDragType);
  if(!id)return;
  event.preventDefault();setHoverTargetId(null);
  const idea=tasks.find(t=>t.id===id&&t.labels.includes('想法池'));
  if(!idea)return;
  const target=targetAt(event.clientX,event.clientY);
  if(target)void placeIdea(idea,target);else stageIdea(idea,{x:event.clientX,y:event.clientY});
 }
 const {nodes:layoutNodes,edges}=useMemo(()=>{
  const nodes:Node[]=[]; const edges:Edge[]=[]; let row=0;
  const visited=new Set<string>();
  function visit(t:Task,depth:number){
   if(visited.has(t.id))return;visited.add(t.id);
   const kids=children(t.id); const hidden=collapsed.includes(t.id);
   const prerequisites=t.relations.blockedBy;
   const dependents=active.filter(other=>other.relations.blockedBy.some(b=>b.id===t.id));
   nodes.push({id:t.id,position:{x:depth*320,y:0},draggable:!placing&&t.id!==goal?.id,sourcePosition:'right' as never,targetPosition:'left' as never,
    style:{width:285,padding:0,border:`2px solid ${current?.id===t.id?'#488cff':'#566071'}`,borderRadius:14,background:'var(--atlas-card)',color:'var(--atlas-text)'},
    data:{label:<div className="atlas-node"><NodeStatus task={t} onStatus={onStatus}/>{t.id===current?.id&&<span className="atlas-status"> · 当前聚焦</span>}<button className="atlas-title" onClick={()=>choose(t.id)}>{t.title}</button>{kids.length>0 && <button className="atlas-fold nodrag" onClick={e=>{e.stopPropagation();toggle(t.id);}}>{hidden?'展开':'折叠'} {kids.length} 个分支</button>}{(prerequisites.length>0||dependents.length>0)&&<DependencyBadge title={t.title} prerequisites={prerequisites.map(r=>byId.get(r.id)?.title||r.title)} dependents={dependents.map(t=>t.title)} />}</div>}});
   if(!hidden)kids.forEach(k=>{edges.push({id:t.id+'-'+k.id,source:t.id,target:k.id,type:'smoothstep',style:{stroke:'#8394ab',strokeWidth:1.6}});visit(k,depth+1);});
   const node=nodes.find(n=>n.id===t.id)!; const visibleKids=kids.map(k=>nodes.find(n=>n.id===k.id)).filter(Boolean);
   node.position.y=visibleKids.length && !hidden ? visibleKids.reduce((sum,n)=>sum+n!.position.y,0)/visibleKids.length : row++*160;
  }
  if(goal)visit(goal,0);
  if(stagedIdea)nodes.push({id:stagedIdea.id,position:stagedPosition,draggable:true,selectable:false,className:'atlas-staged-node',style:{width:285,padding:0,border:'2px dashed #65d5a9',borderRadius:14,background:'var(--atlas-card)',color:'var(--atlas-text)'},data:{label:<div className="atlas-node"><span className="atlas-status">待放置 · 尚未加入主线</span><strong className="atlas-title">{stagedIdea.title}</strong></div>}});
  return {nodes,edges};
 },[tasks,goal?.id,current?.id,collapsed.join(','),stagedIdeaId,stagedPosition.x,stagedPosition.y,placing]);
 useEffect(()=>{setNodes(layoutNodes);},[layoutNodes,setNodes]);
 useEffect(()=>{
  setNodes(previous=>previous.map(node=>{
   const className=node.id===stagedIdeaId?'atlas-staged-node':node.id===hoverTargetId?'atlas-drop-target':undefined;
   return node.className===className?node:{...node,className};
  }));
 },[hoverTargetId,stagedIdeaId,layoutNodes,setNodes]);
 async function status(s:TaskStatus){if(!current)return;setPending(true);setError('');try{await onStatus(current,s);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setPending(false);}}
 return <section className="task-atlas" aria-label="任务图谱">
  <header className="atlas-overview"><div className="atlas-eyebrow">看见全局</div><select aria-label="选择总目标" value={goal?.id || ''} onChange={e=>{setGoalId(e.target.value);setFocus('');persist('',collapsed,e.target.value);}}>{!goal&&<option value="">1.总目标：尚未设置</option>}{roots.map(r=><option key={r.id} value={r.id}>1.{r.title}</option>)}</select>
   <div className="atlas-progress">{finished} / {leaves.length} 个末级任务已完成 <progress value={finished} max={leaves.length || 1}/></div>
   <nav className="atlas-stages" aria-label="主阶段">{stages.map((s,i)=><button key={s.id} onClick={()=>choose(s.id)} className={path.some(t=>t.id===s.id)?'selected':''}><span style={{color:colors[s.status]}}>{i+1}.</span> {s.title.replace(/^\d+[.、]\s*/, '')} <small>{names[s.status]}</small></button>)}</nav>
  </header>
  <div className="atlas-tools"><button onClick={()=>flow?.fitView({padding:.2,duration:250})}>查看全图</button><button onClick={()=>{if(!current)return;const c=collapsed.filter(id=>!path.some(t=>t.id===id));setCollapsed(c);persist(focus,c);setTimeout(()=>flow?.fitView({nodes:[{id:current.id}],maxZoom:1,duration:250}),60);}}>定位当前</button><button onClick={()=>{setCollapsed([]);persist(focus,[]);}}>展开全部</button></div>
  {stagedIdea&&<div className="atlas-placement-bar" role="status"><span>待放置：{stagedIdea.title}。拖到目标节点上，成为它的子任务。</span><button disabled={placing} onClick={()=>void placeIdea(stagedIdea,null)}>设为独立总目标</button><button disabled={placing} onClick={()=>{setStagedIdeaId(null);setHoverTargetId(null);setPlacementError('');}}>取消放置</button></div>}
  {placementError&&<p role="alert">{placementError}</p>}
  {placementNotice&&<p role="status">{placementNotice}</p>}
  <div ref={canvasRef} className="atlas-canvas" onDragOverCapture={onCanvasDragOver} onDragLeave={()=>setHoverTargetId(null)} onDropCapture={onCanvasDrop}><ReactFlow nodes={nodes} onNodesChange={onNodesChange} edges={edges} fitView minZoom={.15} maxZoom={2} panOnDrag={false} panActivationKeyCode={null} autoPanOnNodeDrag={false} panOnScroll panOnScrollMode={PanOnScrollMode.Free} zoomOnScroll={false} nodesDraggable={false} nodesConnectable={false} onInit={setFlow} onNodeClick={(_,n)=>{if(n.id!==stagedIdeaId)choose(n.id);}} nodeDragThreshold={5} onNodeDrag={dragNode} onNodeDragStop={finishNodeDrag}><Background/><MiniMap style={{width:110,height:70}} maskColor="rgba(10,18,30,.45)" zoomable nodeColor={n=>colors[byId.get(n.id)?.status || 'todo']}/></ReactFlow></div>
  {current && <aside className="atlas-focus"><h2 className="atlas-section-heading">2.任务状态</h2><div className="atlas-path">{path.map(t=>t.id===goal?.id?t.title:stateTitle(t.title)).join(' › ')}</div><strong>{current.id===goal?.id?current.title:stateTitle(current.title)}</strong><p>{current.description || '尚未添加说明'}</p><div className="atlas-actions"><select aria-label="当前任务状态" disabled={pending} value={current.status} onChange={e=>void status(e.target.value as TaskStatus)}>{Object.entries(names).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button onClick={()=>onOpen(current)}>编辑详情与子任务</button></div>{error&&<p role="alert">{error}</p>}</aside>}
  <IdeaPool tasks={tasks} onOpen={onOpen} onCreate={onCreateIdea} onStage={stageIdea}/>

 </section>;
}
