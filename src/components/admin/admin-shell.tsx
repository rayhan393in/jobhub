"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookCopy, CalendarClock, CalendarDays, ChartNoAxesColumn, ChevronLeft, ClipboardCheck,
  Columns3, FileCheck2, FileUp, GitMerge, GraduationCap, Home, Landmark, LayoutDashboard, Lock, Menu, Network, PenLine, Radio,
  Rocket, ScrollText, Search, Settings, ShieldCheck, Sparkles, Upload, UserCog, Users, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import type { PermissionKey } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIconLike;
  permission?: PermissionKey;
  hint: string;
};

type LucideIconLike = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** The 15 admin modules, in the order they appear in the navigation. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "ওভারভিউ", icon: LayoutDashboard, hint: "সামগ্রিক অবস্থা" },
  { href: "/admin/questions", label: "প্রশ্নব্যাংক", icon: BookCopy, permission: "question.edit", hint: "প্রশ্ন সম্পাদনা" },
  { href: "/admin/review", label: "রিভিউ কিউ", icon: ClipboardCheck, permission: "question.review", hint: "অনুমোদন ও বাতিল" },
  { href: "/admin/import", label: "ইমপোর্ট", icon: FileUp, permission: "question.import", hint: "CSV / JSON / Excel" },
  { href: "/admin/ai", label: "AI জেনারেটর", icon: Sparkles, permission: "question.import", hint: "Gemini খসড়া" },
  { href: "/admin/bulk", label: "বাল্ক অ্যাকশন", icon: Columns3, permission: "question.review", hint: "ফিল্টার-স্কোপড" },
  { href: "/admin/courses", label: "কোর্স ও ট্যাক্সোনমি", icon: GraduationCap, permission: "taxonomy.manage", hint: "কোর্স · বিষয় · টপিক" },
  { href: "/admin/taxonomy", label: "টপিক ডাটাবেস", icon: Network, permission: "taxonomy.manage", hint: "অনুমোদন · বাল্ক · কমন লাইব্রেরি" },
  { href: "/admin/canonical", label: "কেন্দ্রীয় বিষয়", icon: BookCopy, permission: "taxonomy.manage", hint: "একবার সংরক্ষণ · বহু কোর্সে" },
  { href: "/admin/exam-registry", label: "পরীক্ষা রেজিস্ট্রি", icon: Landmark, permission: "question.review", hint: "নাম · সাল · ধাপ · পদ" },
  { href: "/admin/routines", label: "রুটিন ম্যানেজার", icon: CalendarDays, permission: "routine.manage", hint: "রুটিন তৈরি" },
  { href: "/admin/study-routine", label: "৬০-দিন স্টাডি হাব", icon: CalendarDays, permission: "routine.manage", hint: "কভারেজ · ৭০:৩০ প্রস্তুতি" },
  { href: "/admin/frequency", label: "প্রশ্ন-ফ্রিকোয়েন্সি", icon: ChartNoAxesColumn, permission: "question.import", hint: "বিগত বছরের বিশ্লেষণ" },
  { href: "/admin/evidence", label: "এভিডেন্স ভেরিফায়ার", icon: FileCheck2, permission: "question.review", hint: "বিগত-বছরের প্রমাণ" },
  { href: "/admin/merges", label: "মার্জ রিভিউ", icon: GitMerge, permission: "taxonomy.manage", hint: "ক্যানোনিকাল লিংক" },
  { href: "/admin/exams", label: "পরীক্ষা প্রকাশ", icon: Radio, permission: "exam.publish", hint: "ভ্যালিডেশন সহ" },
  { href: "/admin/schedules", label: "পরীক্ষার সময়সূচি", icon: CalendarClock, permission: "exam.publish", hint: "ড্রাফট ও সময়" },
  { href: "/admin/written-exams", label: "লিখিত পরীক্ষা", icon: ClipboardCheck, permission: "exam.publish", hint: "খাতা তৈরি · মূল্যায়ন" },
  { href: "/admin/attempts", label: "পরীক্ষার্থীর প্রচেষ্টা", icon: Upload, permission: "attempt.inspect", hint: "জমা ও ফলাফল" },
  { href: "/admin/students", label: "শিক্ষার্থী", icon: Users, permission: "student.manage", hint: "অ্যাকাউন্ট ও রোল" },
  { href: "/admin/analytics", label: "অ্যানালিটিক্স", icon: ChartNoAxesColumn, permission: "analytics.view", hint: "বাস্তব ডেটা" },
  { href: "/admin/audit", label: "অডিট লগ", icon: ScrollText, permission: "audit.view", hint: "সব পরিবর্তন" },
  { href: "/admin/settings", label: "সিস্টেম সেটিংস", icon: Settings, permission: "settings.manage", hint: "সীমা ও ডিফল্ট" },
  { href: "/admin/roles", label: "রোল ও অনুমতি", icon: UserCog, permission: "role.manage", hint: "সুপার অ্যাডমিন" },
];

export function AdminShell({
  user,
  permissions,
  children,
}: {
  user: { name: string; role: RoleId };
  permissions: PermissionKey[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const allowed = new Set(permissions);
  const items = ADMIN_NAV.filter((item) => !item.permission || allowed.has(item.permission));

  return (
    <div className="flex min-h-dvh bg-[#f4f2fc] dark:bg-[var(--surface-muted)]">
      {/* Dark violet sidebar, following the reference design system */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-gradient-to-b from-[#241b63] via-[#1e1856] to-[#120e38] text-white lg:flex">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_18px_-6px_rgba(168,85,247,0.7)]">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-extrabold leading-tight tracking-tight">JobHub</p>
            <p className="text-[0.5625rem] font-medium text-violet-200/80">Learn · Practice · Excel</p>
          </div>
          <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider text-violet-200">
            Admin
          </span>
        </div>

        {/* Signed-in admin, like the reference profile chip */}
        <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] px-2.5 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[0.75rem] font-bold text-white">
            {user.name.trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-semibold text-white">{user.name}</p>
            <p className="flex items-center gap-1 text-[0.5625rem] text-violet-200/80">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
              {ROLE_LABELS[user.role].bn}
            </p>
          </div>
          <ShieldCheck className="size-3.5 text-violet-200/70" aria-hidden />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4" aria-label="Admin">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-[0.4375rem] text-[0.75rem] font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-violet-100/70 hover:bg-white/[0.08] hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[0.9375rem] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[0.6875rem] font-medium text-violet-200/80 hover:text-white"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            শিক্ষার্থী ড্যাশবোর্ড
          </Link>
          <div className="mt-2 rounded-2xl bg-gradient-to-br from-violet-600/50 to-fuchsia-600/30 p-3 text-center">
            <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-white/15 text-white">
              <Rocket className="size-4" aria-hidden />
            </span>
            <p className="mt-1.5 text-[0.6875rem] font-bold leading-snug text-white">Build a Better Future</p>
            <p className="text-[0.5625rem] text-violet-200/80">with JobHub</p>
            <Link
              href="/admin/analytics"
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[0.625rem] font-bold text-[#241b63] transition hover:bg-violet-50"
            >
              View Analytics →
            </Link>
          </div>
          <p className="mt-2 text-center text-[0.5625rem] font-medium text-violet-300/50">v2.0.0</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar, following the reference design */}
        <header className="sticky top-0 z-40 hidden h-16 items-center gap-3 border-b border-violet-100/80 bg-white/85 px-6 backdrop-blur dark:border-[var(--border)] dark:bg-[var(--surface)]/90 lg:flex">
          <form action="/admin/questions" method="get" className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="প্রশ্ন, টপিক বা কীওয়ার্ড খুঁজুন…"
              className="h-10 w-full rounded-full border border-violet-100 bg-violet-50/60 pl-10 pr-16 text-[0.8125rem] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-200 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:focus:bg-[var(--surface)] dark:focus:ring-violet-500/30"
              aria-label="প্রশ্ন খুঁজুন"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-violet-100 bg-white px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--text-subtle)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)]">
              Enter ↵
            </kbd>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="h-6 w-px bg-violet-100 dark:bg-[var(--border)]" aria-hidden />
            <div className="flex items-center gap-2 rounded-full border border-violet-100 bg-white py-1 pl-1 pr-3 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]">
              <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[0.625rem] font-bold text-white">
                {user.name.trim().charAt(0)}
              </span>
              <div className="leading-tight">
                <p className="max-w-32 truncate text-[0.6875rem] font-semibold text-[var(--text)]">{user.name}</p>
                <p className="text-[0.5rem] text-[var(--text-subtle)]">{ROLE_LABELS[user.role].bn}</p>
              </div>
            </div>
          </div>
        </header>

        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-gradient-to-r from-[#241b63] to-[#1e1856] px-4 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-white/20 text-white"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <GraduationCap className="size-4" aria-hidden />
          </span>
          <span className="text-[0.875rem] font-extrabold tracking-tight">JobHub</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-violet-100">
            Admin
          </span>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>

        {open ? (
          <nav className="fixed inset-x-0 top-14 z-40 grid max-h-[calc(100dvh-3.5rem)] gap-0.5 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium",
                    pathname === item.href ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--text-muted)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            <Link href="/dashboard" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[0.8125rem] text-[var(--text-subtle)]">
              <Home className="size-4" aria-hidden />
              শিক্ষার্থী ড্যাশবোর্ড
            </Link>
          </nav>
        ) : null}

        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PermissionBadge({ permission }: { permission: PermissionKey }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
      <Lock className="size-2.5" aria-hidden />
      {permission}
    </span>
  );
}

export const MODULE_ICONS = {
  questions: PenLine,
  practice: ClipboardCheck,
  routine: CalendarDays,
} as const;
