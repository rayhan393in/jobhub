"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";

const STORAGE_KEY = "jobhub-theme";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable in private mode */
  }
}

/** FOUC-free theme bootstrap, injected in <head>. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t?t==='dark':m;if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  // The <html> class is the single source of truth, so we subscribe to it rather
  // than mirroring it into state (which would need an effect and cause a flash).
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]",
        className,
      )}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  );
}
