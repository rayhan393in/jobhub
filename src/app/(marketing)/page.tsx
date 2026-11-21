import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";
import {
  ClosingCta, Hero, HowItWorks, LearningFeatures, LiveExamPreview, PrepTracks, RoutinePreview,
} from "@/components/marketing/landing-sections";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PLATFORM_FAQ } from "@/components/marketing/faq-data";
import { listCourses, listPublishedSchedules, listRoutines } from "@/lib/queries";
import { dhakaDateKey } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getPlatformStats() {
  const stats = { courses: 0, subjects: 0, questions: 0, exams: 0 };
  if (!isSupabaseConfigured) return stats;
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });

  const [courses, subjects, exams, verified] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase
      .from("exam_schedules")
      .select("id", { count: "exact", head: true })
      .in("status", ["published", "completed"]),
    supabase.rpc("jh_public_question_count", { p_course_id: null }),
  ]);

  stats.courses = courses.count ?? 0;
  stats.subjects = subjects.count ?? 0;
  stats.exams = exams.count ?? 0;
  stats.questions = typeof verified.data === "number" ? verified.data : 0;
  return stats;
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  const [courses, schedules, routines, stats] = await Promise.all([
    listCourses(),
    listPublishedSchedules({ limit: 6 }),
    listRoutines({ fromDate: dhakaDateKey(), limit: 6 }),
    getPlatformStats(),
  ]);

  return (
    <>
      <Hero signedIn={Boolean(user)} stats={stats} />
      <PrepTracks courses={courses} />
      <LiveExamPreview schedules={schedules} now={Date.now()} />
      <RoutinePreview routines={routines} />
      <LearningFeatures />
      <HowItWorks />

      <section className="border-b border-[var(--border)] py-14 sm:py-16" aria-labelledby="faq-heading">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              সাধারণ প্রশ্ন
            </p>
            <h2 id="faq-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
              যা জানতে চান
            </h2>
          </div>
          <FaqAccordion items={PLATFORM_FAQ.slice(0, 6)} />
        </div>
      </section>

      <ClosingCta signedIn={Boolean(user)} />
    </>
  );
}
