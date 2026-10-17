import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import type { EventStatus } from '../shared/model';

export function Brand({ small = false }: { small?: boolean }) {
  return <a href="/" className={`brand ${small ? 'small' : ''}`} aria-label="Common Hours home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>common<br />hours<span className="brand-dot">.</span></span></a>;
}
export function Button({ children, variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'plain' | 'danger' }) {
  return <button type="button" className={`button ${variant} ${className}`} {...props}>{children}</button>;
}
export function Status({ status }: { status: EventStatus }) {
  const labels = { draft: 'Taking shape', planned: 'Arranging details', ready: 'Ready to go', completed: 'Time well spent' };
  return <span className={`status ${status}`}><span />{labels[status]}</span>;
}
export function Modal({ title, description, children, close }: { title: string; description?: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="modal-title">
    <div className="modal-head"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={21} /></button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warm' | 'success' }) { return <div className={`notice ${tone}`}>{children}</div>; }
export function CopyLink({ value, label = 'Copy link', onCopy }: { value: string; label?: string; onCopy: (message: string) => void }) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); onCopy('Link copied.'); }
    catch { onCopy('Copy the link from the field below.'); }
  }
  return <div className="copy-link"><input value={value} readOnly aria-label={label} onFocus={e => e.target.select()} /><Button onClick={copy}><Copy size={15} />{label}</Button></div>;
}
export function SectionTitle({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{action}</div>;
}
export function CheckPill({ children }: { children: ReactNode }) { return <span className="check-pill"><Check size={14} />{children}</span>; }
export function ExternalLink({ url, children }: { url: string; children: ReactNode }) { return <a href={url} target="_blank" rel="noreferrer" className="text-link">{children}<ArrowUpRight size={14} /></a>; }
