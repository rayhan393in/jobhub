"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookCopy, CalendarClock, CalendarDays, ChartNoAxesColumn, ChevronLeft, ClipboardCheck,
  Columns3, FileUp, GraduationCap, Home, LayoutDashboard, Lock, Menu, Network, PenLine, Radio,
  ScrollText, Settings, ShieldCheck, Sparkles, Upload, UserCog, Users, X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
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
  { href: "/admin/routines", label: "রুটিন ম্যানেজার", icon: CalendarDays, permission: "routine.manage", hint: "রুটিন তৈরি" },
  { href: "/admin/frequency", label: "প্রশ্ন-ফ্রিকোয়েন্সি", icon: ChartNoAxesColumn, permission: "question.import", hint: "বিগত বছরের বিশ্লেষণ" },
  { href: "/admin/exams", label: "পরীক্ষা প্রকাশ", icon: Radio, permission: "exam.publish", hint: "ভ্যালিডেশন সহ" },
  { href: "/admin/schedules", label: "পরীক্ষার সময়সূচি", icon: CalendarClock, permission: "exam.publish", hint: "ড্রাফট ও সময়" },
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
    <div className="flex min-h-dvh bg-[var(--surface-muted)]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 items-center gap-2 px-4">
          <Logo size={30} showTagline={false} />
          <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider text-[var(--brand)]">
            Admin
          </span>
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
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[0.9375rem] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[0.6875rem] font-medium text-[var(--text-subtle)] hover:text-[var(--brand)]"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            শিক্ষার্থী ড্যাশবোর্ড
          </Link>
          <div className="mt-1 flex items-center gap-2 rounded-xl px-1 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[0.625rem] font-bold text-[var(--brand)]">
              {user.name.trim().charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.6875rem] font-semibold text-[var(--text)]">{user.name}</p>
              <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">{ROLE_LABELS[user.role].bn}</p>
            </div>
            <ShieldCheck className="size-3.5 text-[var(--text-subtle)]" aria-hidden />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--border)]"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Logo size={26} showTagline={false} />
          <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-[var(--brand)]">
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
