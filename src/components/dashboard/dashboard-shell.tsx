"use client";

import * as React from "react";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck, Bot, CalendarDays, ChartNoAxesColumn, ChevronLeft, GraduationCap, History,
  Home, Layers, LogOut, Menu, NotebookPen, PenLine, Radio, Rocket, Settings, ShieldCheck,
  Trophy, X, Library,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import type { RoleId } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  badge?: { text: string; tone: "live" | "ai" };
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", icon: Home },
  { href: "/my-courses", label: "আমার কোর্স (My Courses)", icon: GraduationCap },
  { href: "/practice", label: "প্র্যাকটিস প্রশ্ন", icon: BookOpenCheck },
  { href: "/exams", label: "লাইভ পরীক্ষা", icon: Radio, badge: { text: "LIVE", tone: "live" } },
  { href: "/custom-exam", label: "মডেল টেস্ট", icon: Layers },
  { href: "/practice?mode=previous", label: "পূর্ববর্তী বছরের প্রশ্ন", icon: History },
  { href: "/written-exams", label: "লিখিত পরীক্ষা", icon: PenLine },
  { href: "/routines", label: "স্টাডি রুটিন", icon: CalendarDays },
  { href: "/analytics", label: "বিশ্লেষণ ও রিপোর্ট", icon: ChartNoAxesColumn },
  { href: "/bookmarks", label: "ভুল প্রশ্নের সংগ্রহ", icon: NotebookPen },
  { href: "/leaderboard", label: "লিডারবোর্ড", icon: Trophy },
  { href: "/dashboard#ai-coach", label: "AI স্টাডি কোচ", icon: Bot, badge: { text: "AI", tone: "ai" } },
  { href: "/dashboard#calendar", label: "স্টাডি ক্যালেন্ডার", icon: Library },
  { href: "/account", label: "অ্যাকাউন্ট", icon: Settings },
];

const STAFF_NAV: NavItem[] = [
  { href: "/admin", label: "অ্যাডমিন সেন্টার", icon: ShieldCheck },
];

export function DashboardShell({
  user,
  children,
}: {
  user: { id: string; name: string; email: string | null; role: RoleId; avatarUrl: string | null; targetCourseId: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);


  const isStaff = user.role === "admin" || user.role === "super_admin" || user.role === "content_editor";
  const nav = isStaff ? [...NAV, ...STAFF_NAV] : NAV;

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  // The exam runner takes over the whole screen: no sidebar, no topbar, no padding.
  if (pathname.startsWith("/exam/")) {
    return <>{children}</>;
  }

  return (
    <div className="jh-app-bg flex min-h-dvh">
      {/* Desktop sidebar — dark violet, matching the admin design system */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-gradient-to-b from-[#241b63] via-[#1e1856] to-[#120e38] text-white lg:flex 2xl:w-72">
        <div className="flex items-center gap-3 px-4 pb-3 pt-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_18px_-6px_rgba(168,85,247,0.7)]">
            <GraduationCap className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[1.125rem] font-extrabold leading-tight tracking-tight">JobHub</p>
            <p className="text-[0.625rem] font-medium text-violet-200/80">Learn · Practice · Excel</p>
          </div>
        </div>

        {/* Signed-in student chip */}
        <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] px-2.5 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[0.8125rem] font-bold text-white">
            {user.name.trim().charAt(0) || "শ"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-semibold text-white">{user.name}</p>
            <p className="flex items-center gap-1 text-[0.625rem] text-violet-200/80">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
              {ROLE_LABELS[user.role].bn}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-lg p-1.5 text-violet-200/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4" aria-label="Dashboard">
          {nav.map((item) => {
            const base = item.href.split(/[?#]/)[0];
            const plain = !item.href.includes("?") && !item.href.includes("#");
            const active = plain && (pathname === base || pathname.startsWith(`${base}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-violet-100/70 hover:bg-white/[0.08] hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[0.5625rem] font-extrabold tracking-wide",
                      item.badge.tone === "live" ? "bg-red-500 text-white" : "bg-fuchsia-500 text-white",
                    )}
                  >
                    {item.badge.text}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/50 to-fuchsia-600/30 p-3 text-center">
            <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-white/15 text-white">
              <Rocket className="size-4" aria-hidden />
            </span>
            <p className="mt-1.5 text-[0.75rem] font-bold leading-snug text-white">Build a Better Future</p>
            <p className="text-[0.625rem] text-violet-200/80">with JobHub</p>
            <Link
              href="/practice"
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[0.625rem] font-bold text-[#241b63] transition hover:bg-violet-50"
            >
              প্র্যাকটিস শুরু করুন →
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-40 hidden h-16 items-center gap-3 border-b border-violet-100/80 bg-white/85 px-6 backdrop-blur dark:border-[var(--border)] dark:bg-[var(--surface)]/90 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-[1.0625rem] font-extrabold tracking-tight text-[var(--text)]">
              স্বাগতম, <span className="text-[var(--brand)]">{user.name}</span> 👋
            </p>
            <p className="truncate text-[0.75rem] font-medium text-[var(--text-muted)]">
              {formatDate(new Date(), "bn", { weekday: "long", day: "numeric", month: "long" })} · আজকের প্রস্তুতি আজই শেষ করুন
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="h-6 w-px bg-violet-100 dark:bg-[var(--border)]" aria-hidden />
            <div className="flex items-center gap-2 rounded-full border border-violet-100 bg-white py-1 pl-1 pr-3 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]">
              <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[0.625rem] font-bold text-white">
                {user.name.trim().charAt(0) || "শ"}
              </span>
              <div className="leading-tight">
                <p className="max-w-32 truncate text-[0.6875rem] font-semibold text-[var(--text)]">{user.name}</p>
                <p className="text-[0.5rem] text-[var(--text-subtle)]">{ROLE_LABELS[user.role].bn}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile top bar */}
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
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
          </div>
        </header>

        {open ? (
          <nav
            className="fixed inset-x-0 top-14 z-40 grid max-h-[calc(100dvh-3.5rem)] gap-0.5 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden"
            aria-label="Mobile dashboard"
          >
            {nav.map((item) => {
              // Match nested routes too (e.g. /results/123) so the tab stays
              // highlighted — mirrors the desktop sidebar behaviour above.
              const base = item.href.split(/[?#]/)[0];
              const plain = !item.href.includes("?") && !item.href.includes("#");
              const active = plain && (pathname === base || pathname.startsWith(`${base}/`));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium",
                    active ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--text-muted)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[0.5rem] font-extrabold tracking-wide text-white",
                        item.badge.tone === "live" ? "bg-red-500" : "bg-fuchsia-500",
                      )}
                    >
                      {item.badge.text}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={signOut}
              className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.875rem] font-medium text-[var(--text-muted)]"
            >
              <LogOut className="size-4" aria-hidden />
              লগআউট
            </button>
          </nav>
        ) : null}

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-5 lg:px-6 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-[var(--text-muted)] hover:text-[var(--brand)]"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-balance text-[1.375rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.625rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-pretty text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
