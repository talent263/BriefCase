"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { cx } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (title: string, kind?: ToastKind, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((title: string, kind: ToastKind = "success", detail?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((previous) => [...previous, { id, title, detail, kind }]);
    window.setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-card">
            <span className={cx("toast-icon", toast.kind === "error" && "toast-icon-error")}>
              {toast.kind === "error" ? <CircleAlert size={17} /> : <Check size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.detail ? <p className="mt-0.5 text-xs text-muted">{toast.detail}</p> : null}
            </div>
            <button className="icon-button" aria-label="Dismiss notification" onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider.");
  return value;
}
