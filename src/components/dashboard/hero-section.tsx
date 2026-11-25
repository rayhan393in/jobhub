import Link from "next/link";
import Image from "next/image";
import { BookOpenCheck, CheckCircle2, Play, Radio } from "lucide-react";
import { formatNumber, formatTime } from "@/lib/format";
import type { Routine, StudentAnalytics } from "@/lib/types";
import type { ScheduleWithCourse } from "@/lib/queries";

/**
 * Dashboard hero (V7 mockup-exact): left desk illustration, centered
 * headline + enrolled-course chips + action buttons, right progress ring
 * and Daily Goals panel. Pure server component — all data arrives as
 * props from the page orchestrator.
 */
export type DailyGoal = { id: string; label: string; done: boolean };

export function HeroSection({
  nameBn: _nameBn,
  summary: _summary,
  hasData: _hasData,
  todayStudy: _todayStudy,
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
      className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#5b21b6] text-white shadow-[0_24px_50px_-20px_rgba(91,33,182,0.65)]"
    >
      {/* soft radial light accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 size-[24rem] rounded-full bg-[radial-gradient(circle,rgba(216,180,254,0.25),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 size-[22rem] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.3),transparent_65%)]"
      />

      <div className="relative z-10 flex flex-col items-stretch gap-3.5 p-4 sm:gap-4 sm:p-5 xl:flex-row xl:items-center">
        {/* বাঁ — ডেস্ক ইলাস্ট্রেশন: হিরোর পুরো উচ্চতা জুড়ে */}
        <div className="relative hidden min-h-[13rem] shrink-0 self-stretch overflow-hidden rounded-xl shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)] xl:block xl:w-60 2xl:w-[21rem]">
          <Image
            src="/images/hero-study.jpg"
            alt=""
            fill
            sizes="(min-width: 1536px) 352px, 304px"
            priority
            className="object-cover"
          />
        </div>

        {/* মাঝ — পিল, টাইটেল, কোর্স চিপ, বাটন */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 xl:items-center xl:text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-1 text-[0.6875rem] font-bold text-white xl:px-4 xl:py-1.5 xl:text-[0.8125rem]">
            📅 JobHub — Your Multi-Course Preparation Hub
          </p>
          <h1 id="hero-h" className="font-bangla text-[1.5rem] font-extrabold leading-snug sm:text-[1.75rem] xl:text-[2rem] 2xl:text-[2.125rem]">
            আজকের প্রস্তুতি সম্পন্ন করুন
          </h1>
          <p className="font-bangla text-[0.875rem] leading-relaxed text-violet-100 xl:text-[0.9375rem]">
            একাধিক কোর্সের প্রস্তুতি, প্র্যাকটিস, পরীক্ষা ও বিশ্লেষণ — সব এক জায়গায়।
          </p>

          {/* Enrolled course ✓ chips */}
          {enrolledTitles.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2 xl:justify-center">
              {enrolledTitles.slice(0, 4).map((title) => (
                <li key={title} className="inline-flex items-center gap-1.5 text-[0.75rem] font-bold text-white xl:text-[0.9375rem]">
                  <CheckCircle2 className="size-4 rounded-full bg-emerald-500 text-white xl:size-5" aria-hidden />
                  {title}
                </li>
              ))}
              <li>
                <Link
                  href="/my-courses"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-white transition hover:bg-white/20 xl:px-3 xl:py-1 xl:text-[0.8125rem]"
                >
                  + আরও
                </Link>
              </li>
            </ul>
          ) : null}

          {/* Action buttons */}
          <div className="mt-1 flex flex-wrap items-center gap-2.5 xl:justify-center">
            <Link
              href="/routines"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[0.8125rem] font-bold text-[#5b21b6] xl:px-5 xl:py-3 xl:text-[0.9375rem] shadow-[0_8px_20px_-8px_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              <Play className="size-3.5 fill-[#5b21b6]" aria-hidden />
              পড়াশোনা চালিয়ে যান
            </Link>
            {liveExam ? (
              <Link
                href={liveExam.my_attempt_id ? `/exam/${liveExam.my_attempt_id}` : `/exams/${liveExam.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-[0.8125rem] font-bold text-white xl:px-5 xl:py-3 xl:text-[0.9375rem] shadow-[0_8px_20px_-8px_rgba(244,63,94,0.7)] transition hover:-translate-y-0.5 hover:brightness-110"
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-2.5 text-[0.8125rem] font-bold text-amber-200 xl:px-5 xl:py-3 xl:text-[0.9375rem] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-amber-400/25"
              >
                <Radio className="size-3.5" aria-hidden />
                আজকের লাইভ পরীক্ষা · {formatTime(todayExam.starts_at)} থেকে
              </Link>
            ) : (
              <Link
                href="/exams"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/[0.12] px-4 py-2.5 text-[0.8125rem] font-bold text-white backdrop-blur-sm xl:px-5 xl:py-3 xl:text-[0.9375rem] transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                <Radio className="size-3.5" aria-hidden />
                লাইভ পরীক্ষা
              </Link>
            )}
            <Link
              href="/practice"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/[0.12] px-4 py-2.5 text-[0.8125rem] font-bold text-white backdrop-blur-sm xl:px-5 xl:py-3 xl:text-[0.9375rem] transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              <BookOpenCheck className="size-3.5" aria-hidden />
              প্র্যাকটিস প্রশ্ন
            </Link>
          </div>
        </div>

        {/* ডান — সবুজ অগ্রগতি রিং + Daily Goals (mockup-এর দুই প্যানেল) */}
        {goals.length > 0 ? (
          <div className="flex w-full shrink-0 flex-row items-center gap-3 xl:w-auto">
            <div className="flex items-center justify-center">
              <div
                className="relative flex size-24 shrink-0 items-center justify-center rounded-full sm:size-36 2xl:size-40"
                style={{
                  background: `conic-gradient(#22c55e ${progressPct * 3.6}deg, rgba(255,255,255,0.16) 0deg)`,
                }}
                role="img"
                aria-label={`আজকের অগ্রগতি ${progressPct}%`}
              >
                <div className="absolute inset-[10%] flex flex-col items-center justify-center rounded-full bg-[#4c1d95]">
                  <span className="text-[1.25rem] font-extrabold tabular-nums leading-none text-white sm:text-[1.625rem] 2xl:text-[1.875rem]">
                    {formatNumber(progressPct)}%
                  </span>
                  <span className="mt-0.5 text-[0.5625rem] font-semibold text-violet-200 sm:text-[0.6875rem]">আজকের অগ্রগতি</span>
                  <span className="text-[0.5625rem] font-bold text-emerald-300 sm:text-[0.6875rem]">
                    {formatNumber(doneCount)}/{formatNumber(goals.length)} টাস্কে
                  </span>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/[0.08] p-3 backdrop-blur-sm sm:p-4 xl:w-60 xl:flex-none 2xl:w-[18rem]">
              <p className="text-[0.8125rem] font-bold text-white xl:text-[0.9375rem]">আজকের লক্ষ্য (Daily Goals)</p>
              <ul className="mt-2.5 space-y-2">
                {goals.slice(0, 3).map((goal) => (
                  <li key={goal.id} className="flex items-center gap-2 text-[0.8125rem] font-semibold xl:text-[0.875rem]">
                    <span
                      className={
                        goal.done
                          ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                          : "size-5 shrink-0 rounded-full border-2 border-white/40 bg-white/90"
                      }
                      aria-hidden
                    >
                      {goal.done ? <CheckCircle2 className="size-3.5" /> : null}
                    </span>
                    <span className="truncate text-white">{goal.label}</span>
                  </li>
                ))}
              </ul>
              {goals.length > 3 ? (
                <Link href="/routines" className="mt-2 inline-block text-[0.6875rem] font-semibold text-violet-200 hover:underline xl:text-[0.75rem]">
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
