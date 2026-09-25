import { useRef, useState, type DragEvent } from 'react';
import type { Task } from '../types';

export const ideaDragType = 'application/x-task-atlas-idea';

export function IdeaPool({ tasks, onOpen, onCreate, onStage }: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onCreate: (title: string, description: string) => Promise<unknown>;
  onStage: (idea: Task) => void;
}) {
  const ideaDialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const ideas = tasks.filter(task => !task.archivedAt && task.labels.includes('想法池'));

  async function save() {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onCreate(title.trim(), description.trim());
      ideaDialog.current?.close();
      setTitle('');
      setDescription('');
      setExpanded(true);
      setNotice('已加入当前项目的想法池。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  function stage(idea: Task) {
    onStage(idea);
    setNotice('');
  }

  function startDrag(event: DragEvent<HTMLDivElement>, idea: Task) {
    event.dataTransfer.setData(ideaDragType, idea.id);
    event.dataTransfer.effectAllowed = 'move';
    setNotice('');
  }

  return <section className="atlas-idea-pool" aria-label="想法池">
    <h2 className="atlas-section-heading">3.新想法</h2>
    <div className="atlas-idea-heading">
      <button className="atlas-add-idea" onClick={() => { setError(''); setNotice(''); ideaDialog.current?.showModal(); }}>添加想法</button>
      <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>想法池 · {ideas.length} 条</button>
      <span>暂存方向；拖到导图节点可加入主线</span>
    </div>
    {notice && <p role="status">{notice}</p>}
    {expanded && <div className="atlas-idea-list">{ideas.length ? ideas.map(idea => <div className="atlas-idea-item" key={idea.id} draggable onDragStart={event => startDrag(event, idea)}>
      <button className="atlas-idea-open" onClick={() => onOpen(idea)}>{idea.title}</button>
      <button className="atlas-idea-promote" onClick={() => stage(idea)}>加入任务</button>
    </div>) : <p>还没有想法。点击“添加想法”直接记录。</p>}</div>}

    <dialog ref={ideaDialog} className="atlas-idea-dialog" aria-labelledby="idea-dialog-title" onCancel={event => { if (saving) event.preventDefault(); }}>
      <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <h2 id="idea-dialog-title">添加想法</h2><p>保存到当前项目，之后再决定是否加入主计划。</p>
        <label htmlFor="idea-title">想法标题</label><input autoFocus id="idea-title" required maxLength={200} value={title} disabled={saving} onChange={event => setTitle(event.target.value)} placeholder="例如：给学习系统增加每周复盘"/>
        <label htmlFor="idea-description">补充说明（选填）</label><textarea id="idea-description" rows={4} maxLength={10000} value={description} disabled={saving} onChange={event => setDescription(event.target.value)} placeholder="为什么想到它？以后可以怎样展开？"/>
        {error && <p role="alert">{error}</p>}
        <div className="atlas-idea-actions"><button type="button" disabled={saving} onClick={() => ideaDialog.current?.close()}>取消</button><button type="submit" disabled={saving || !title.trim()}>{saving ? '保存中…' : '保存到想法池'}</button></div>
      </form>
    </dialog>
  </section>;
}
