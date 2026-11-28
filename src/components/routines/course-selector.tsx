"use client";

/**
 * Searchable course selector.
 *
 * The list is whatever the database returned for this user — never a literal in
 * this file — so a course an administrator publishes tomorrow appears here with
 * no frontend change.
 *
 * Interaction notes:
 *  - It is a real listbox: the trigger owns focus, the list is navigated with
 *    arrows/Home/End, Enter selects, Escape closes and returns focus.
 *  - Typing filters on the Bengali title, the English title, and the slug, so a
 *    student can find "পেট্রোবাংলা" or "petrobangla" and get the same row.
 *  - The trigger is a full-width button, so it behaves on a 360px screen rather
 *    than collapsing like a native select with long Bengali labels.
 */

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type CourseOption = {
  id: string;
  title_bn: string;
  title_en?: string | null;
  hasRoutine: boolean;
  enrolled?: boolean;
};

export function CourseSelector({
  courses,
  value,
  onChange,
  label = "কোর্স নির্বাচন করুন",
}: {
  courses: CourseOption[];
  value: string;
  onChange: (courseId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = courses.find((course) => course.id === value) ?? null;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return courses;
    return courses.filter((course) =>
      [course.title_bn, course.title_en ?? "", course.id]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [courses, query]);

  // Keep the cursor inside the filtered list as it shrinks.
  React.useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function openList() {
    setOpen(true);
    setQuery("");
    const index = courses.findIndex((course) => course.id === value);
    setCursor(index >= 0 ? index : 0);
    // Focus the search box on the next paint, once it exists.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closeList(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(course: CourseOption) {
    if (!course.hasRoutine) return; // nothing to switch to yet
    onChange(course.id);
    closeList();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setCursor((current) => {
        const next = current + step;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setCursor(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setCursor(Math.max(0, filtered.length - 1));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const course = filtered[cursor];
      if (course) choose(course);
      return;
    }
    if (event.key === "Enter" && !open) {
      event.preventDefault();
      openList();
    }
  }

  // Scroll the cursor into view without triggering a page jump.
  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[cursor] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  return (
    <div className="w-full">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="course-listbox"
        aria-label={label}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-medium text-[var(--text-muted)]">{label}</span>
          <span className="block truncate text-[0.9375rem] font-bold text-[var(--text)]">
            {selected ? selected.title_bn : "কোর্স বেছে নিন"}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-[var(--text-muted)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Search className="size-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                type="text"
                placeholder="কোর্স খুঁজুন…"
                aria-label="কোর্স খুঁজুন"
                aria-controls="course-listbox"
                aria-autocomplete="list"
                className="w-full border-0 bg-transparent p-0 text-[0.8125rem] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
              />
            </div>

            <ul
              ref={listRef}
              id="course-listbox"
              role="listbox"
              aria-label="কোর্স তালিকা"
              className="max-h-72 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-[0.8125rem] text-[var(--text-muted)]">
                  এই নামে কোনো কোর্স পাওয়া যায়নি।
                </li>
              ) : (
                filtered.map((course, index) => {
                  const isSelected = course.id === value;
                  const isCursor = index === cursor;
                  return (
                    <li
                      key={course.id}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={!course.hasRoutine}
                      tabIndex={-1}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => choose(course)}
                      className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2"
                      style={{
                        backgroundColor: isCursor ? "var(--surface-muted)" : undefined,
                        opacity: course.hasRoutine ? 1 : 0.55,
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                          {course.title_bn}
                        </span>
                        {!course.hasRoutine ? (
                          <span className="block text-[0.6875rem] text-[var(--text-muted)]">
                            কোনো সক্রিয় রুটিন নেই
                          </span>
                        ) : course.enrolled ? (
                          <span className="block text-[0.6875rem] text-[var(--text-muted)]">এনরোলড</span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check className="size-4 shrink-0" style={{ color: "var(--brand)" }} aria-hidden />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
