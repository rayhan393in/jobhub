import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for a production outage.
 *
 * `/routines` is a Server Component (it awaits `getCurrentUser`, queries
 * Supabase, and has no "use client"). An inline `onChange` arrow calling
 * `window.location.assign(new URL(window.location.href)…)` was written straight
 * into its JSX. That is not allowed across the server/client boundary, so the
 * route threw at request time and every visitor got error.tsx — while the build
 * and the type checker stayed green, because neither evaluates a server render.
 *
 * These tests are source-level on purpose: the failure mode has no type error,
 * so asserting on the file is what actually catches it.
 */

const PAGE = join(process.cwd(), "src/app/(dashboard)/routines/page.tsx");
const SWITCHER = join(process.cwd(), "src/components/routines/course-switcher.tsx");

const page = readFileSync(PAGE, "utf8");

/** Strip comments so prose about `window` does not trip the scans. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/.*$/gm, "");
}

describe("routines page — server/client boundary", () => {
  it("is a Server Component", () => {
    // No "use client": it must stay async and query the database directly.
    expect(page.slice(0, 400)).not.toMatch(/^\s*"use client"/m);
    expect(page).toContain("export default async function RoutinesPage");
  });

  it("never touches browser globals in the server component", () => {
    const code = stripComments(page);
    // Each of these throws during a server render.
    expect(code).not.toContain("window.");
    expect(code).not.toContain("document.");
    expect(code).not.toContain("localStorage");
    expect(code).not.toContain("sessionStorage");
  });

  it("passes no inline event handlers to client components", () => {
    const code = stripComments(page);
    // `onX={(` or `onX={() => …}` in a Server Component's JSX is the bug.
    expect(code).not.toMatch(/\bon[A-Z]\w*=\{\s*\(/);
    expect(code).not.toMatch(/\bonClick=\{/);
    expect(code).not.toMatch(/\bonChange=\{/);
    expect(code).not.toMatch(/\bonSubmit=\{/);
  });

  it("delegates course switching to a client component", () => {
    // The switcher owns navigation; the page only hands it data.
    expect(page).toContain("<CourseSwitcher");
    expect(page).toContain('from "@/components/routines/course-switcher"');
  });
});

describe("course switcher — client boundary", () => {
  const switcher = readFileSync(SWITCHER, "utf8");

  it("declares itself a client component", () => {
    expect(switcher.slice(0, 100)).toContain('"use client"');
  });

  it("navigates with the router, not window.location", () => {
    // window.location.assign would force a full reload and lose the RSC nav.
    expect(switcher).toContain("useRouter");
    expect(switcher).toContain("router.replace");
    expect(stripComments(switcher)).not.toContain("window.location");
  });

  it("scopes the switch to ?course= and preserves nothing stale", () => {
    expect(switcher).toContain("/routines?course=");
    expect(switcher).toContain("encodeURIComponent");
  });
});
