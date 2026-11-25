"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookCopy, CalendarClock, CalendarDays, ChartNoAxesColumn, ChevronLeft, ClipboardCheck,
  Columns3, FileCheck2, FileUp, GitMerge, GraduationCap, Home, Landmark, LayoutDashboard,
  Lock, Menu, Network, PenLine, Radio, ScrollText, Search, Settings, ShieldCheck,
  Sparkles, Upload, UserCog, Users, X,
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

const ADMIN_NAV_GROUPS = [
  { label: "কন্ট্রোল সেন্টার", hrefs: ["/admin"] },
  { label: "প্রশ্ন ও কনটেন্ট", hrefs: ["/admin/questions", "/admin/review", "/admin/import", "/admin/ai", "/admin/bulk", "/admin/courses", "/admin/taxonomy", "/admin/canonical", "/admin/exam-registry", "/admin/frequency", "/admin/evidence", "/admin/merges"] },
  { label: "পরীক্ষা ও রুটিন", hrefs: ["/admin/exams", "/admin/schedules", "/admin/written-exams", "/admin/attempts", "/admin/routines", "/admin/study-routine"] },
  { label: "শিক্ষার্থী ও রিপোর্ট", hrefs: ["/admin/students", "/admin/analytics", "/admin/audit"] },
  { label: "সিস্টেম", hrefs: ["/admin/settings", "/admin/roles"] },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function NavLink({ item, active, onNavigate }: { item: AdminNavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.hint}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[0.8125rem] font-medium transition-colors",
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_2px_0_0_var(--brand)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active ? <span className="size-1.5 rounded-full bg-[var(--brand)]" aria-hidden /> : null}
    </Link>
  );
}

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
  const [query, setQuery] = React.useState("");
  const allowed = new Set(permissions);
  const items = ADMIN_NAV.filter((item) => !item.permission || allowed.has(item.permission));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => `${item.label} ${item.hint}`.toLocaleLowerCase().includes(normalizedQuery))
    : items;
  const navGroups = ADMIN_NAV_GROUPS
    .map((group) => ({ ...group, items: filteredItems.filter((item) => group.hrefs.includes(item.href)) }))
    .filter((group) => group.items.length > 0);
  const activeItem = items.find((item) => isActivePath(pathname, item.href)) ?? items[0];

  return (
    <div className="flex min-h-dvh bg-[var(--surface-muted)]">
      <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-[4.25rem] items-center gap-3 border-b border-[var(--border)] px-5">
          <Logo size={32} showTagline={false} />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-[var(--text)]">JobHub</p>
            <p className="text-[0.6875rem] text-[var(--text-subtle)]">Administration</p>
          </div>
          <span className="ml-auto rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-[var(--brand)]">Admin</span>
        </div>
        <div className="px-3 pb-2 pt-4">
          <label htmlFor="admin-nav-search" className="sr-only">অ্যাডমিন মেনু খুঁজুন</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
            <input id="admin-nav-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="মেনু খুঁজুন..." className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] pl-9 pr-3 text-[0.8125rem] text-[var(--text)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15" />
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="অ্যাডমিন নেভিগেশন">
          {navGroups.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-[var(--text-subtle)]">কোনো মেনু পাওয়া যায়নি</p>
          ) : navGroups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-1.5 px-3 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{group.label}</h2>
              <div className="space-y-0.5">
                {group.items.map((item) => <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />)}
              </div>
            </section>
          ))}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <Link href="/dashboard" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]">
            <ChevronLeft className="size-4" aria-hidden /> শিক্ষার্থী ড্যাশবোর্ড
          </Link>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-[var(--surface-muted)] p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand)]">{user.name.trim().charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--text)]">{user.name}</p>
              <p className="truncate text-[0.6875rem] text-[var(--text-subtle)]">{ROLE_LABELS[user.role].bn}</p>
            </div>
            <ShieldCheck className="size-4 text-[var(--success)]" aria-label="Staff account" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text)]" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Logo size={27} showTagline={false} />
          <span className="rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[0.625rem] font-bold uppercase text-[var(--brand)]">Admin</span>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>

        {open ? (
          <nav className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg lg:hidden" aria-label="মোবাইল অ্যাডমিন নেভিগেশন">
            <label htmlFor="admin-mobile-search" className="sr-only">অ্যাডমিন মেনু খুঁজুন</label>
            <input id="admin-mobile-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="মেনু খুঁজুন..." className="mb-3 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
            <div className="space-y-4">
              {navGroups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-1 px-3 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{group.label}</h2>
                  <div className="space-y-0.5">
                    {group.items.map((item) => <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} onNavigate={() => setOpen(false)} />)}
                  </div>
                </section>
              ))}
            </div>
            <Link href="/dashboard" onClick={() => setOpen(false)} className="mt-3 flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--text-muted)]">
              <Home className="size-4" aria-hidden /> শিক্ষার্থী ড্যাশবোর্ড
            </Link>
          </nav>
        ) : null}

        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-7 backdrop-blur lg:flex">
          <div className="min-w-0">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">JobHub / Admin</p>
            <p className="truncate text-sm font-semibold text-[var(--text)]">{activeItem?.label ?? "অ্যাডমিন সেন্টার"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">{ROLE_LABELS[user.role].bn}</span>
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[88rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PermissionBadge({ permission }: { permission: PermissionKey }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
      <Lock className="size-3" aria-hidden />
      {permission}
    </span>
  );
}

export const MODULE_ICONS = {
  questions: PenLine,
  practice: ClipboardCheck,
  routine: CalendarDays,
} as const;
