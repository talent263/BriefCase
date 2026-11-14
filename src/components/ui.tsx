"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, eyebrow, onClose, children, size = "normal" }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; size?: "normal" | "wide" }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-card ${size === "wide" ? "!max-w-[680px]" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="flex items-start justify-between border-b border-line px-6 py-5 sm:px-7">
          <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2 id="modal-title" className="mt-1 font-display text-lg font-bold tracking-[-.03em]">{title}</h2></div>
          <button className="icon-button -mr-2 -mt-1" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="px-6 py-5 sm:px-7">{children}</div>
      </section>
    </div>
  );
}

export function FormField({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return <div><label className="field-label" htmlFor={htmlFor}>{label}</label>{children}{error ? <p className="field-error">{error}</p> : null}</div>;
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-[#efd2cb] bg-[#fcf2ef] px-3 py-2.5 text-[11px] leading-5 text-[#a64f42]">{children}</div>;
}

export function SaveButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button type="submit" disabled={busy} className="btn-primary disabled:cursor-wait disabled:opacity-60">{busy ? "Saving…" : children}</button>;
}

export function DeleteButton({ onClick, label = "Delete" }: { onClick: () => void; label?: string }) {
  return <button className="icon-button btn-danger" title={label} aria-label={label} onClick={onClick}><X size={15} /></button>;
}
