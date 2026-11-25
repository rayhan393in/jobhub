import Link from "next/link";
import {
  BarChart3, BookCopy, CalendarDays, FileQuestion, Layers, NotebookPen, Plus,
  Radio, Settings2, History, Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Course } from "@/lib/types";

/**
 * Course context selector — the mockup's "আমার কোর্সসমূহ" bar.
 * Pure links (server-rendered): ?course=all | ?course=<id>; the default
 * course (profiles.target_course_id) persists the context across logins.
 */
export function CourseContextBar({
  enrolledCourses,
  selectedId,
  defaultId,
}: {
  enrolledCourses: Course[];
  selectedId: string | null; // null = সব কোর্স
  defaultId: string | null;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <span className="inline-flex items-center gap-1.5 px-1.5 text-[0.75rem] font-bold text-[var(--text)]">
        <Layers className="size-3.5 text-[var(--brand)]" aria-hidden />
        আমার কোর্সসমূহ
        {enrolledCourses.length > 0 ? (
          <span className="font-medium text-[var(--text-subtle)]">({enrolledCourses.length}টি কোর্স)</span>
        ) : null}
      </span>

      <Link
        href="/dashboard?course=all"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[0.75rem] font-semibold transition",
          selectedId === null
            ? "bg-[var(--brand)] text-white shadow-sm"
            : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
        )}
      >
        <Layers className="size-3" aria-hidden />
        সব কোর্স (All)
      </Link>

      {enrolledCourses.map((course) => (
        <Link
          key={course.id}
          href={`/dashboard?course=${course.id}`}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[0.75rem] font-semibold transition",
            selectedId === course.id
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
          )}
        >
          {course.id === defaultId ? <Target className="size-3" aria-hidden /> : null}
          {course.title_bn}
        </Link>
      ))}

      <span className="ml-auto flex items-center gap-1.5">
        <Link
          href="/my-courses"
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-dashed border-[var(--brand)]/50 px-3 text-[0.75rem] font-semibold text-[var(--brand)] transition hover:bg-[var(--brand-soft)]"
        >
          <Plus className="size-3" aria-hidden />
          কোর্স যোগ করুন
        </Link>
        <Link
          href="/my-courses"
          aria-label="কোর্স ব্যবস্থাপনা"
          className="inline-flex size-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-subtle)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
        >
          <Settings2 className="size-3.5" aria-hidden />
        </Link>
      </span>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: "/practice", label: "প্র্যাকটিস প্রশ্ন", icon: FileQuestion, tone: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15" },
  { href: "/exams", label: "লাইভ পরীক্ষা", icon: Radio, tone: "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-500/15" },
  { href: "/custom-exam", label: "মডেল টেস্ট", icon: BookCopy, tone: "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/15" },
  { href: "/practice?mode=previous", label: "পূর্ববর্তী প্রশ্ন", icon: History, tone: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" },
  { href: "/routines", label: "স্টাডি রুটিন", icon: CalendarDays, tone: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15" },
  { href: "/bookmarks", label: "ভুল ও বুকমার্ক", icon: NotebookPen, tone: "text-pink-600 bg-pink-100 dark:text-pink-300 dark:bg-pink-500/15" },
  { href: "/analytics", label: "রিপোর্ট", icon: BarChart3, tone: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15" },
] as const;

/** Quick actions grid — the mockup's "দ্রুত প্রবেশ (Quick Actions)" card. */
export function QuickActions({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section className="jh-card p-4" aria-label="দ্রুত প্রবেশ">
        <h2 className="mb-2.5 text-[0.9375rem] font-bold text-[var(--text)]">⚡ দ্রুত প্রবেশ (Quick Actions)</h2>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] p-2 text-center transition hover:border-[var(--brand)]/40 hover:shadow-sm"
              >
                <span className={cn("flex size-8 items-center justify-center rounded-lg", action.tone)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-[0.5625rem] font-semibold leading-tight text-[var(--text-muted)]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <section className="mt-5" aria-label="দ্রুত প্রবেশ">
      <h2 className="mb-2 text-[0.8125rem] font-bold text-[var(--text)]">⚡ দ্রুত প্রবেশ (Quick Actions)</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="jh-card flex flex-col items-center gap-1.5 p-3 text-center transition hover:border-[var(--brand)]/40 hover:shadow-md"
            >
              <span className={cn("flex size-9 items-center justify-center rounded-xl", action.tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-[0.6875rem] font-semibold text-[var(--text-muted)]">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
