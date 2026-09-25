import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function UserGuide() {
 const boardUrl = `/${window.location.search}`;
 const isPublicGuide = import.meta.env.BASE_URL !== '/';
 const [dark,setDark]=useState(()=>localStorage.getItem('taskboard.guide-theme')==='dark');
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 const [menu,setMenu]=useState(false);
 const [searchOpen,setSearchOpen]=useState(false);
 const [query,setQuery]=useState('');
 const search=useRef<HTMLInputElement>(null);
 useEffect(()=>{const controller=new AbortController();fetch(`${import.meta.env.BASE_URL}guide.md`,{signal:controller.signal,cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('使用指南加载失败，请刷新重试。');return r.text();}).then(setText).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
 useEffect(()=>{if(searchOpen)search.current?.focus();},[searchOpen]);
 const chapters=text.split(/^## /m).slice(1).map((part,index)=>({index,title:part.split('\n')[0],body:part.slice(part.indexOf('\n')+1)}));
 const results=chapters.filter(c=>(c.title+c.body).toLowerCase().includes(query.trim().toLowerCase()));
 function jump(index:number){setMenu(false);setSearchOpen(false);history.replaceState(null,'',`#section-${index}`);document.getElementById(`section-${index}`)?.scrollIntoView({behavior:'smooth',block:'start'});}
 return <div className={`manual-site${dark?" manual-dark":""}`} onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);setSearchOpen(false);}}}>
  <header className="manual-header"><button aria-expanded={menu} aria-controls="manual-outline" onClick={()=>{setMenu(!menu);setSearchOpen(false);}}>☰ <span>Menu</span></button><a className="manual-brand" href="#top">见全局·山海有径使用指南</a><div className="manual-header-actions">{!isPublicGuide&&<a href={boardUrl}>返回看板</a>}<button aria-label={dark?"切换为浅色":"切换为深色"} onClick={()=>{setDark(!dark);localStorage.setItem("taskboard.guide-theme",dark?"light":"dark");}}>{dark?"浅色":"深色"}</button><button onClick={()=>{setSearchOpen(true);setMenu(false);}} aria-label="搜索使用指南">搜索 <kbd>⌕</kbd></button></div></header>
  {menu&&<><button className="manual-shade" aria-label="关闭目录" onClick={()=>setMenu(false)}/><nav id="manual-outline" className="manual-outline" aria-label="使用指南大纲"><strong>使用指南</strong>{chapters.map(c=><button key={c.index} onClick={()=>jump(c.index)}>{c.title}</button>)}</nav></>}
  {searchOpen&&<div className="manual-search-shade" onClick={()=>setSearchOpen(false)}><section className="manual-search" role="dialog" aria-modal="true" aria-label="搜索使用指南" onClick={e=>e.stopPropagation()}><div><input ref={search} type="search" placeholder="搜索文档…" aria-label="搜索关键词" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>setSearchOpen(false)}>关闭</button></div>{query.trim()?<><p>找到 {results.length} 个章节</p>{results.map(c=><button className="manual-result" key={c.index} onClick={()=>jump(c.index)}>{c.title}</button>)}</>:<p>输入关键词查找操作说明</p>}</section></div>}
  <main id="top" className="manual-article"><div className="manual-intro"><h1>见全局·山海有径使用指南</h1><p>从建立计划到推进任务，在这里了解看板的使用方法。</p></div>{error&&<p role="alert">{error}</p>}{!text&&!error&&<p>正在加载指南…</p>}{chapters.map(c=><section id={`section-${c.index}`} key={c.index} className="manual-section"><h2>{c.title}</h2><ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown></section>)}<footer><a href="#top">返回顶部</a>{!isPublicGuide&&<a href={boardUrl}>返回看板</a>}</footer></main>
 </div>;
}
