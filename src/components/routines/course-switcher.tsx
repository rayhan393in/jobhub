"use client";

/**
 * Client wrapper that owns course switching on the server-rendered routine page.
 *
 * Why this exists: `routines/page.tsx` is a Server Component, so an inline
 * `onChange` arrow / `window` access / `new URL(window.location.href)` inside it
 * throws at request time ("Event handlers cannot be passed to Client Component
 * props" / `window is not defined`) and the whole route falls into error.tsx.
 * Navigation logic therefore lives here, behind a "use client" boundary.
 *
 * It navigates with the router rather than `window.location`, so the transitions
 * stay client-side (no full reload) and the RSC payload is re-fetched for the new
 * `?course=` value.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CourseSelector, type CourseOption } from "./course-selector";

export function CourseSwitcher({
  courses,
  value,
}: {
  courses: CourseOption[];
  value: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const handleChange = React.useCallback(
    (courseId: string) => {
      // The server reloads every per-course value (routine, marks, priorities,
      // progress, history) from `?course=`, so two courses can never share state
      // on screen. `replace` keeps browser history clean.
      startTransition(() => {
        router.replace(`/routines?course=${encodeURIComponent(courseId)}`, { scroll: false });
      });
    },
    [router],
  );

  return (
    <div className="max-w-md" aria-busy={pending}>
      <CourseSelector courses={courses} value={value} onChange={handleChange} />
      {pending ? (
        <p className="mt-1 text-[0.6875rem] text-[var(--text-muted)]" role="status">
          রুটিন লোড হচ্ছে…
        </p>
      ) : null}
    </div>
  );
}
