"use client";

import * as React from "react";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";

/**
 * Header checkbox + bulk-action buttons for the question table. Lives INSIDE
 * the server-rendered <form>: checkboxes are plain `name="ids"` inputs, so the
 * form posts fine; this component only adds selection count, select-all and
 * confirmation UX on top.
 */

function useSelectionCount() {
  const ref = React.useRef<HTMLElement | null>(null);
  const [count, setCount] = React.useState(0);

  const recount = React.useCallback(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    setCount(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
  }, []);

  React.useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    recount();
    form.addEventListener("change", recount);
    return () => form.removeEventListener("change", recount);
  }, [recount]);

  return { ref, count, recount };
}

export function SelectAllBox() {
  const ref = React.useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="সব প্রশ্ন নির্বাচন করুন"
      className="size-3.5 accent-[var(--brand)]"
      onChange={(event) => {
        const form = event.currentTarget.closest("form");
        if (!form) return;
        for (const box of form.querySelectorAll<HTMLInputElement>('input[name="ids"]')) {
          box.checked = event.currentTarget.checked;
        }
        // Re-announce so the bulk bar recounts.
        form.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}

export function BulkBar() {
  const { ref, count } = useSelectionCount();
  const disabled = count === 0;

  const confirmDestructive = (message: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };

  const base =
    "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[0.6875rem] font-bold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[0.6875rem] font-bold tabular-nums text-[var(--brand)]">
        {count}টি নির্বাচিত
      </span>
      <button
        type="submit"
        name="action"
        value="approve"
        disabled={disabled}
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300`}
      >
        <CheckCircle2 className="size-3" aria-hidden />
        অনুমোদন করুন
      </button>
      <button
        type="submit"
        name="action"
        value="reject"
        disabled={disabled}
        onClick={confirmDestructive(`${count}টি প্রশ্ন প্রত্যাখ্যান করবেন?`)}
        className={`${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300`}
      >
        <XCircle className="size-3" aria-hidden />
        প্রত্যাখ্যান করুন
      </button>
      <button
        type="submit"
        name="action"
        value="archive"
        disabled={disabled}
        onClick={confirmDestructive(
          `${count}টি প্রশ্ন আর্কাইভ করবেন? আর্কাইভ করা প্রশ্ন পরীক্ষা বা প্র্যাকটিসে আসবে না (পরে পুনরুদ্ধারযোগ্য)।`,
        )}
        className={`${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300`}
      >
        <Trash2 className="size-3" aria-hidden />
        আর্কাইভ করুন
      </button>
    </span>
  );
}
