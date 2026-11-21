"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, string> = {
  success: "border-mint-100 bg-mint-50 text-mint-700 dark:border-mint-600/30 dark:bg-mint-600/15 dark:text-mint-500",
  error: "border-red-100 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  info: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
};

const icons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
  error: <AlertTriangle className="size-4 shrink-0" aria-hidden />,
  info: <Info className="size-4 shrink-0" aria-hidden />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const seq = React.useRef(0);

  const toast = React.useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++seq.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[0.8125rem] font-medium shadow-[0_16px_40px_-24px_rgba(22,26,51,.5)]",
              toneStyles[t.tone],
            )}
          >
            {icons[t.tone]}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              type="button"
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
