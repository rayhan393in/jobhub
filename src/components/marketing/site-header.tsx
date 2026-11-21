"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, UserRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/courses", label: "কোর্স" },
  { href: "/exams", label: "লাইভ পরীক্ষা" },
  { href: "/practice", label: "প্র্যাকটিস" },
  { href: "/leaderboard", label: "লিডারবোর্ড" },
  { href: "/about", label: "আমাদের সম্পর্কে" },
  { href: "/faq", label: "প্রশ্নোত্তর" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-200",
        scrolled
          ? "border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-lg"
          : "border-transparent bg-[var(--surface)]/70 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo size={34} showTagline={false} />

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {signedIn ? (
            <ButtonLink href="/dashboard" size="sm" className="hidden sm:inline-flex">
              <LayoutDashboard className="size-3.5" aria-hidden />
              ড্যাশবোর্ড
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                লগইন
              </ButtonLink>
              <ButtonLink href="/register" size="sm" className="hidden sm:inline-flex">
                <UserRound className="size-3.5" aria-hidden />
                শুরু করুন
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-[var(--border)] bg-[var(--surface)] lg:hidden">
          <nav className="mx-auto grid w-full max-w-7xl gap-1 px-4 py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm font-medium",
                  pathname === item.href
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--text-muted)]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <ThemeToggle />
              {signedIn ? (
                <ButtonLink href="/dashboard" size="sm" className="flex-1">
                  ড্যাশবোর্ড
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="secondary" size="sm" className="flex-1">
                    লগইন
                  </ButtonLink>
                  <ButtonLink href="/register" size="sm" className="flex-1">
                    রেজিস্ট্রেশন
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
