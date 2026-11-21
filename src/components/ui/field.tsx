"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={htmlFor} className="jh-label">
        {label}
        {required ? <span className="ml-0.5 text-[var(--danger)]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--text-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("jh-input", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("jh-input appearance-none bg-[length:0] pr-9", className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn("jh-input min-h-28 resize-y", className)} {...props} />;
  },
);

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-1", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--brand)]"
        {...props}
      />
      <span className="text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
        <span className="block font-medium text-[var(--text)]">{label}</span>
        {description ? <span className="mt-0.5 block">{description}</span> : null}
      </span>
    </label>
  );
}
