import Link from "next/link";
import { BookOpenCheck, CalendarDays, CheckCircle2, Play, Radio } from "lucide-react";
import { formatDate, formatNumber, formatPercent, formatTime, greeting } from "@/lib/format";
import type { Routine, StudentAnalytics } from "@/lib/types";
import type { ScheduleWithCourse } from "@/lib/queries";

/**
 * Dashboard hero: greeting, today's study chips and the primary call to
 * action (live exam → today's exam → exam centre). Pure server component —
 * all data arrives as props from the page orchestrator.
 */
export type DailyGoal = { id: string; label: string; done: boolean };

export function HeroSection({
  nameBn,
  summary,
  hasData,
  todayStudy,
  liveExam,
  todayExam,
  enrolledTitles = [],
  goals = [],
}: {
  nameBn: string;
  summary: StudentAnalytics["summary"] | undefined;
  hasData: boolean;
  todayStudy: Routine[];
  liveExam: ScheduleWithCourse | null;
  todayExam: ScheduleWithCourse | null;
  /** Enrolled course titles for the ✓ indicator chips (V7 mockup). */
  enrolledTitles?: string[];
  /** Today's routine tasks with real completion from routine_progress. */
  goals?: DailyGoal[];
}) {
  const doneCount = goals.filter((g) => g.done).length;
  const progressPct = goals.length > 0 ? Math.round((doneCount / goals.length) * 100) : 0;
  return (
    <section
      aria-labelledby="hero-h"
      className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1856] via-[#171242] to-[#0d0a2b] text-white shadow-[0_24px_50px_-20px_rgba(23,18,66,0.65)]"
    >
      {/* Colored light: depth without noise — a violet sun top-right, an indigo ember bottom-left. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.35),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -left-24 size-[24rem] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.4),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      <HeroBooksArt />
      <div className="relative z-10 flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8 xl:flex-row xl:items-stretch xl:justify-between">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-violet-200">
          <CalendarDays className="size-3" aria-hidden />
          {formatDate(new Date(), "bn", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 id="hero-h" className="font-bangla mt-2.5 text-[1.375rem] font-bold leading-snug sm:text-[1.625rem]">
          {greeting("bn")}, <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">{nameBn}</span>
        </h1>
        <p className="font-bangla mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-indigo-100/95">
          {hasData
            ? `আপনি এখন পর্যন্ত ${formatNumber(summary?.attempts ?? 0)}টি পরীক্ষা সম্পন্ন করেছেন। গড় নির্ভুলতা ${formatPercent(summary?.avg_accuracy ?? 0)}।`
            : "আপনার প্রস্তুতির যাত্রা শুরু হোক। প্রথম পরীক্ষা দিলেই এখানে বাস্তব বিশ্লেষণ দেখা যাবে।"}
        </p>

        {/* Enrolled course indicators — V7 mockup ✓ chips */}
        {enrolledTitles.length > 0 ? (
          <ul className="mt-3 flex flex-wrap items-center gap-1.5">
            {enrolledTitles.slice(0, 4).map((title) => (
              <li
                key={title}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.1] px-2.5 py-1 text-[0.6875rem] font-semibold text-white"
              >
                <CheckCircle2 className="size-3 text-emerald-400" aria-hidden />
                {title}
              </li>
            ))}
            <li>
              <Link
                href="/my-courses"
                className="inline-flex items-center rounded-full border border-dashed border-white/30 px-2.5 py-1 text-[0.6875rem] font-semibold text-violet-200 transition hover:bg-white/10"
              >
                + আরও
              </Link>
            </li>
          </ul>
        ) : null}

        {/* আজ যা পড়বেন */}
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-white">
            <BookOpenCheck className="size-3.5 text-amber-300" aria-hidden />
            আজ যা পড়বেন
          </p>
          {todayStudy.length === 0 ? (
            <p className="mt-1.5 text-[0.75rem] text-indigo-200/90">
              আজকের জন্য প্রকাশিত রুটিন নেই — প্র্যাকটিস দিয়ে প্রস্তুতি চালিয়ে যান।
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {todayStudy.slice(0, 4).map((routine) => (
                <li
                  key={routine.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.14] px-3 py-1 text-[0.75rem] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" aria-hidden />
                  <span className="truncate">
                    {routine.subject_title_bn ?? routine.title_bn ?? "পড়ার পরিকল্পনা"}
                    {routine.topic_title_bn ? ` — ${routine.topic_title_bn}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link
            href="/practice"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[0.8125rem] font-bold text-[#171242] shadow-[0_8px_20px_-8px_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 hover:bg-violet-50"
          >
            <Play className="size-3.5" aria-hidden />
            প্র্যাকটিস শুরু
          </Link>
          {liveExam ? (
            <Link
              href={liveExam.my_attempt_id ? `/exam/${liveExam.my_attempt_id}` : `/exams/${liveExam.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-[0.8125rem] font-bold text-white shadow-[0_8px_20px_-8px_rgba(244,63,94,0.7)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              লাইভ পরীক্ষা চলছে — অংশ নিন
            </Link>
          ) : todayExam ? (
            <Link
              href={`/exams/${todayExam.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-2.5 text-[0.8125rem] font-bold text-amber-200 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-amber-400/25"
            >
              <Radio className="size-3.5" aria-hidden />
              আজকের লাইভ পরীক্ষা · {formatTime(todayExam.starts_at)} থেকে
            </Link>
          ) : (
            <Link
              href="/exams"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/[0.12] px-4 py-2.5 text-[0.8125rem] font-bold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              <Radio className="size-3.5" aria-hidden />
              পরীক্ষা কেন্দ্র
            </Link>
          )}
        </div>
      </div>

      {/* Right panel — আজকের অগ্রগতি রিং + Daily Goals (real routine_progress) */}
      {goals.length > 0 ? (
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row xl:w-[23rem] xl:flex-col 2xl:w-[26rem] 2xl:flex-row">
          <div className="flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-4 backdrop-blur-sm">
            <div
              className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#a855f7 ${progressPct * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
              }}
              role="img"
              aria-label={`আজকের অগ্রগতি ${progressPct}%`}
            >
              <div className="absolute inset-[11%] flex flex-col items-center justify-center rounded-full bg-[#171242]">
                <span className="text-[1.25rem] font-extrabold tabular-nums text-white">{formatNumber(progressPct)}%</span>
                <span className="text-[0.5625rem] font-medium text-violet-200">আজকের অগ্রগতি</span>
                <span className="text-[0.5625rem] font-semibold text-emerald-300">
                  {formatNumber(doneCount)}/{formatNumber(goals.length)} টাস্ক
                </span>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/[0.07] p-3.5 backdrop-blur-sm">
            <p className="text-[0.75rem] font-bold text-white">আজকের লক্ষ্য (Daily Goals)</p>
            <ul className="mt-2 space-y-1.5">
              {goals.slice(0, 3).map((goal) => (
                <li key={goal.id} className="flex items-center gap-2 text-[0.75rem] font-medium">
                  <span
                    className={
                      goal.done
                        ? "flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                        : "size-4 shrink-0 rounded-full border-2 border-white/30"
                    }
                    aria-hidden
                  >
                    {goal.done ? <CheckCircle2 className="size-3" /> : null}
                  </span>
                  <span className={goal.done ? "truncate text-emerald-200" : "truncate text-white/90"}>
                    {goal.label}
                  </span>
                </li>
              ))}
            </ul>
            {goals.length > 3 ? (
              <Link href="/routines" className="mt-1.5 inline-block text-[0.625rem] font-semibold text-violet-200 hover:underline">
                +{formatNumber(goals.length - 3)}টি আরও কাজ →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
    </section>
  );
}

/** Decorative book/study illustration on the right side of the hero (inline SVG, no external assets). */
function HeroBooksArt() {
  return (
    <svg
      viewBox="0 0 520 360"
      aria-hidden
      className="pointer-events-none absolute -right-6 bottom-0 hidden h-full w-auto select-none md:block"
      fill="none"
    >
      {/* soft glow circles */}
      <circle cx="400" cy="90" r="150" fill="white" fillOpacity="0.08" />
      <circle cx="430" cy="300" r="190" fill="white" fillOpacity="0.09" />
      <circle cx="320" cy="60" r="60" fill="white" fillOpacity="0.1" />
      {/* stacked books */}
      <g opacity="0.9">
        <rect x="258" y="268" width="196" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="272" y="236" width="168" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="286" y="204" width="140" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="300" y="248" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
        <rect x="330" y="216" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
        <rect x="290" y="280" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
      </g>
      {/* open book */}
      <g opacity="0.95">
        <path
          d="M268 160c28-14 62-18 88-10v46c-26-8-60-4-88 10v-46z"
          fill="white"
          fillOpacity="0.7"
        />
        <path
          d="M444 160c-28-14-62-18-88-10v46c26-8 60-4 88 10v-46z"
          fill="white"
          fillOpacity="0.4"
        />
        <path d="M356 150v46" stroke="white" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
        <path d="M282 166c20-8 44-11 62-7M282 180c20-8 44-11 62-7" stroke="#a78bfa" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        <path d="M430 166c-20-8-44-11-62-7M430 180c-20-8-44-11-62-7" stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* graduation cap */}
      <g opacity="0.9">
        <path d="M356 74l62 24-62 24-62-24 62-24z" fill="white" fillOpacity="0.75" />
        <path d="M332 108v22c0 7 11 13 24 13s24-6 24-13v-22" stroke="white" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M414 100v26" stroke="white" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
        <circle cx="414" cy="132" r="5" fill="white" fillOpacity="0.85" />
      </g>
      {/* pencil */}
      <g opacity="0.75">
        <rect x="200" y="226" width="64" height="12" rx="4" transform="rotate(-32 200 226)" fill="white" fillOpacity="0.55" />
        <path d="M196 232l-10 14 17-3-7-11z" fill="white" fillOpacity="0.75" />
      </g>
      {/* sparkles */}
      <path d="M250 96l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill="white" fillOpacity="0.65" />
      <path d="M470 196l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5 2.5-6.5z" fill="white" fillOpacity="0.55" />
    </svg>
  );
}
