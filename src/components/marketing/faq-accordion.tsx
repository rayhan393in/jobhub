"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

import type { FaqItem } from "./faq-data";

export type { FaqItem };

export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div className={cn("divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]", className)}>
      {items.map((item, index) => {
        const expanded = open === index;
        const panelId = `faq-panel-${index}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-muted)]"
              >
                <span className="text-[0.875rem] font-semibold text-[var(--text)]">{item.question}</span>
                <Plus
                  className={cn(
                    "size-4 shrink-0 text-[var(--text-subtle)] transition-transform duration-200",
                    expanded && "rotate-45 text-[var(--brand)]",
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              hidden={!expanded}
              className="px-5 pb-4 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
