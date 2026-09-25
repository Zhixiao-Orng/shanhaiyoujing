import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Release = { version: string; changes: string[] };
const ACK_KEY = 'taskboard.accepted-release';

export function VersionNotice() {
  const [release, setRelease] = useState<Release | null>(null);
  const [ignored, setIgnored] = useState(false);
  const [warning, setWarning] = useState(false);
  const edited = useRef(new Set<HTMLElement>());
  const ignoreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const response = await fetch(`/release.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const next = await response.json() as Release;
        if (alive && typeof next.version === 'string' && Array.isArray(next.changes) && next.changes.every(c => typeof c === 'string')) {
          setRelease(next.version === localStorage.getItem(ACK_KEY) ? null : next);
        }
      } catch { /* Keep the current page usable when the local service is unavailable. */ }
    }
    function record(event: Event) {
      const element = event.target;
      if (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && ['text', 'search', ''].includes(element.type)) || (element instanceof HTMLElement && element.isContentEditable)) edited.current.add(element);
    }
    void check();
    const timer = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    document.addEventListener('input', record);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('input', record); };
  }, []);
  const visible = release !== null && !ignored;
  useEffect(() => { if (visible) ignoreButton.current?.focus(); }, [visible]);
  function update() {
    const hasInput = [...edited.current].some(e => e.isConnected && ('value' in e ? String(e.value).trim() : e.textContent?.trim()));
    if (hasInput && !warning) { setWarning(true); return; }
    if (!release) return;
    localStorage.setItem(ACK_KEY, release.version);
    window.location.reload();
  }
  if (!visible) return null;
  return createPortal(<div className="version-notice-backdrop">
    <section className="version-notice" role="dialog" aria-modal="true" aria-labelledby="version-notice-title" onKeyDown={e => {
      if (e.key === 'Escape') setIgnored(true);
      if (e.key === 'Tab') { const buttons = e.currentTarget.querySelectorAll('button'); const first = buttons[0]; const last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }}>
      <h2 id="version-notice-title">任务看板有更新</h2>
      <p className="version-notice-version">版本 {release.version}</p>
      <ul>{release.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>
      <p>更新将刷新页面。此次忽略后，下次进入仍会提醒。</p>
      {warning && <p role="alert">检测到你编辑过的输入内容，可能尚未保存。请先选择“此次忽略”并保存；确认不需要保留时，也可以继续刷新。</p>}
      <footer><button ref={ignoreButton} onClick={() => setIgnored(true)}>此次忽略</button><button onClick={update}>{warning ? '确认刷新更新' : '更新'}</button></footer>
    </section>
  </div>, document.body);
}
