"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck, CalendarDays, ChartNoAxesColumn, ChevronLeft, GraduationCap, Home,
  Layers, LogOut, Menu, Radio, Settings, ShieldCheck, Trophy, X, Library,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import type { RoleId } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", icon: Home },
  { href: "/courses", label: "কোর্স", icon: GraduationCap },
  { href: "/exams", label: "লাইভ পরীক্ষা", icon: Radio },
  { href: "/practice", label: "প্র্যাকটিস", icon: BookOpenCheck },
  { href: "/custom-exam", label: "কাস্টম পরীক্ষা", icon: Layers },
  { href: "/routines", label: "স্টাডি রুটিন", icon: CalendarDays },
  { href: "/analytics", label: "বিশ্লেষণ", icon: ChartNoAxesColumn },
  { href: "/leaderboard", label: "লিডারবোর্ড", icon: Trophy },
  { href: "/bookmarks", label: "বুকমার্ক", icon: Library },
  { href: "/account", label: "অ্যাকাউন্ট", icon: Settings },
];

const STAFF_NAV = [
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

  return (
    <div className="flex min-h-dvh bg-[var(--surface-muted)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 items-center px-4">
          <Logo size={32} showTagline={false} />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4" aria-label="Dashboard">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2.5">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[0.75rem] font-bold text-[var(--brand)]">
              {user.name.trim().charAt(0) || "শ"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{user.name}</p>
              <p className="truncate text-[0.625rem] text-[var(--text-subtle)]">{ROLE_LABELS[user.role].bn}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:text-[var(--danger)]"
              aria-label="Sign out"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
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
          <Logo size={28} showTagline={false} />
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
              const active = pathname === item.href;
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
                  {item.label}
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

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
