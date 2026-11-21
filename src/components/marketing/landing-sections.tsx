import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, BookOpenCheck, Briefcase, Building2, ClipboardCheck,
  Clock3, Cpu, GraduationCap, Landmark, LineChart, PencilRuler, Play, Radio, ShieldCheck,
  Sparkles, Target, Timer, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, LiveDot } from "@/components/ui/badge";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import type { Course, ExamSchedule, Routine } from "@/lib/types";

export const COURSE_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  banknote: Banknote,
  "building-2": Building2,
  "pencil-ruler": PencilRuler,
  "book-open-check": BookOpenCheck,
  briefcase: Briefcase,
  cpu: Cpu,
  wrench: Wrench,
  "graduation-cap": GraduationCap,
};

export function Hero({
  signedIn,
  stats,
}: {
  signedIn: boolean;
  stats: { courses: number; subjects: number; questions: number; exams: number };
}) {
  return (
    <section className="jh-hero-field relative overflow-hidden border-b border-[var(--border)]">
      <div className="jh-grid-lines pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          {/* ---------------- copy ---------------- */}
          <div className="jh-enter">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--text-muted)] backdrop-blur">
              <BadgeCheck className="size-3.5 text-[var(--brand)]" aria-hidden />
              বাংলাদেশের প্রতিযোগিতামূলক পরীক্ষার জন্য তৈরি
            </div>

            <h1 className="mt-5 text-balance text-[2.125rem] font-extrabold leading-[1.14] tracking-[-0.035em] text-[var(--text)] sm:text-[2.75rem] xl:text-[3.25rem]">
              প্রস্তুতি হোক{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-[linear-gradient(100deg,var(--brand),var(--accent))] bg-clip-text text-transparent">
                  যাচাইকৃত
                </span>
                <svg
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-[var(--brand)]/25"
                  viewBox="0 0 120 10"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M2 7c26-5 62-6 116-2" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" />
                </svg>
              </span>{" "}
              প্রশ্নে, প্রতিদিন।
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-[0.9375rem] leading-[1.8] text-[var(--text-muted)] sm:text-base">
              BCS, ব্যাংক, সরকারি চাকরি, প্রাথমিক শিক্ষক, NTRCA ও EEE — প্রতিটি কোর্সে বিষয়ভিত্তিক
              প্রশ্নব্যাংক, সময়সূচি-ভিত্তিক লাইভ পরীক্ষা এবং আপনার বাস্তব ফলাফলের উপর ভিত্তি করে
              পারফরম্যান্স বিশ্লেষণ।
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href={signedIn ? "/dashboard" : "/register"} size="lg">
                {signedIn ? "ড্যাশবোর্ডে যান" : "বিনামূল্যে শুরু করুন"}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/exams" variant="secondary" size="lg">
                <Radio className="size-4 text-[var(--brand)]" aria-hidden />
                লাইভ পরীক্ষা দেখুন
              </ButtonLink>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { label: "কোর্স", value: stats.courses },
                { label: "বিষয়", value: stats.subjects },
                { label: "প্রশ্ন", value: stats.questions },
                { label: "প্রকাশিত পরীক্ষা", value: stats.exams },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">{item.label}</dt>
                  <dd className="mt-0.5 text-[1.25rem] font-bold tracking-[-0.03em] text-[var(--text)]">
                    {formatNumber(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[0.6875rem] text-[var(--text-subtle)]">
              সংখ্যাগুলো আপনার প্ল্যাটফর্মের প্রকৃত ডেটাবেস থেকে; কোনো সংখ্যা অনুমান করে দেখানো হয় না।
            </p>
          </div>

          {/* ---------------- imagery ---------------- */}
          <div className="jh-enter relative" style={{ animationDelay: "90ms" }}>
            <div className="relative mx-auto max-w-[34rem]">
              {/* soft brand glow behind the photo */}
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_70%_20%,var(--brand-soft),transparent_70%)] blur-2xl"
                aria-hidden
              />

              <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] shadow-[0_24px_60px_-24px_rgba(79,66,228,0.35)]">
                <Image
                  src="/hero-books-bd.jpg"
                  alt="একটি সাজানো পড়ার ডেস্কে বই, খোলা পাঠ্যবই ও কলম"
                  width={1376}
                  height={768}
                  priority
                  sizes="(max-width: 1024px) 100vw, 34rem"
                  className="h-auto w-full object-cover"
                />
                {/* Legibility scrim so floating cards never sit on a busy area */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(10,10,25,0.45),transparent)]" aria-hidden />

                {/* live badge, top-left */}
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[var(--surface)]/95 px-2.5 py-1 text-[0.625rem] font-bold text-[var(--text)] shadow-sm backdrop-blur">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                  </span>
                  প্রতিদিনের প্রস্তুতি
                </div>

                {/* question bank, bottom-left — real counters, never invented
                    scores: this platform has no users yet, so a "72% accuracy"
                    card would be a claim it cannot back up. */}
                <div className="absolute bottom-3 left-3 w-[11rem] rounded-xl bg-[var(--surface)]/95 p-2.5 shadow-lg backdrop-blur">
                  <p className="text-[0.5625rem] font-medium text-[var(--text-subtle)]">প্রশ্নব্যাংক</p>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-[1.125rem] font-bold text-[var(--text)]">
                      {formatNumber(stats.questions)}
                    </span>
                    <span className="text-[0.625rem] font-semibold text-[var(--text-subtle)]">প্রশ্ন</span>
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,var(--brand),var(--accent))]" />
                  </div>
                </div>

                {/* course coverage, bottom-right */}
                <div className="absolute bottom-3 right-3 rounded-xl bg-[var(--surface)]/95 px-2.5 py-2 text-center shadow-lg backdrop-blur">
                  <p className="text-[0.5625rem] font-medium text-[var(--text-subtle)]">বিষয়</p>
                  <p className="text-[0.9375rem] font-bold text-[var(--brand)]">{formatNumber(stats.subjects)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PrepTracks({ courses }: { courses: Course[] }) {
  if (courses.length === 0) return null;
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)] py-14 sm:py-16" aria-labelledby="tracks-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            প্রতিযোগিতামূলক প্রস্তুতি
          </p>
          <h2 id="tracks-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
            প্রতিটি পথের জন্য আলাদা সিলেবাস ও প্রশ্নব্যাংক
          </h2>
          <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            প্রতিটি কোর্সের নিজস্ব বিষয়, টপিক, প্রশ্নব্যাংক, রুটিন ও পরীক্ষা — একই প্ল্যাটফর্মে,
            আলাদা অগ্রগতি ট্র্যাকিংসহ।
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => {
            const Icon = COURSE_ICONS[course.icon] ?? GraduationCap;
            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="jh-card jh-card-hover group flex flex-col p-5"
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    course.accent === "violet"
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
                      : "bg-[var(--brand-soft)] text-[var(--brand)]"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3.5 text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--text)]">
                  {course.title_bn}
                </h3>
                <p className="mt-1 flex-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  {course.summary_bn ??
                    `${course.title_bn} পরীক্ষার জন্য বিষয়ভিত্তিক প্রশ্নব্যাংক ও লাইভ পরীক্ষা।`}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--brand)]">
                  কোর্স দেখুন
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * `now` is passed from the server page so this component stays pure: reading the
 * clock during render would make the list flicker on every re-render.
 */
export function LiveExamPreview({
  schedules,
  now,
}: {
  schedules: (ExamSchedule & { course?: { title_bn: string } })[];
  now: number;
}) {
  return (
    <section className="border-b border-[var(--border)] py-14 sm:py-16" aria-labelledby="live-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              লাইভ পরীক্ষা কেন্দ্র
            </p>
            <h2 id="live-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
              নির্ধারিত সময়ে পরীক্ষা, প্রকাশের পর ফলাফল
            </h2>
            <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              প্রতিটি পরীক্ষার নিজস্ব কাঠামো থাকে — সময়, প্রশ্নসংখ্যা, পূর্ণমান এবং ফলাফল প্রকাশের
              সময়। উত্তরপত্র সংরক্ষিত থাকে, তাই রিফ্রেশ বা নেটওয়ার্ক সমস্যাতেও কিছু হারায় না।
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: <Clock3 className="size-4" />, text: "সার্ভার-নিয়ন্ত্রিত টাইমার ও নির্দিষ্ট মূল্যায়ন" },
                { icon: <Target className="size-4" />, text: "প্রতি সঠিক উত্তরে +১, ভুলে −০.৫, অনুত্তরিতে ০" },
                { icon: <ClipboardCheck className="size-4" />, text: "প্রকাশের আগে ফলাফল ও উত্তরপত্র গোপন থাকে" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2.5 text-[0.875rem] text-[var(--text-muted)]">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                    {item.icon}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
            <ButtonLink href="/exams" variant="outline" size="md" className="mt-6">
              সব লাইভ পরীক্ষা
              <ArrowRight className="size-3.5" aria-hidden />
            </ButtonLink>
          </div>

          <div className="jh-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <h3 className="text-[0.875rem] font-semibold text-[var(--text)]">আসন্ন ও চলমান পরীক্ষা</h3>
              <Badge tone="brand">Asia/Dhaka</Badge>
            </div>
            {schedules.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Radio className="mx-auto size-7 text-[var(--text-subtle)]" aria-hidden />
                <p className="mt-3 text-[0.875rem] font-semibold text-[var(--text)]">এখনো কোনো পরীক্ষা প্রকাশ পায়নি</p>
                <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  প্রশাসক যাচাইকৃত প্রশ্ন দিয়ে পরীক্ষা প্রকাশ করার সাথে সাথে এখানে দেখা যাবে— আগে থেকে
                  কোনো নকল সময়সূচি দেখানো হয় না।
                </p>
                <ButtonLink href="/practice" variant="secondary" size="sm" className="mt-4">
                  প্র্যাকটিস শুরু করুন
                </ButtonLink>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {schedules.slice(0, 5).map((schedule) => {
                  const start = new Date(schedule.starts_at).getTime();
                  const end = new Date(schedule.ends_at).getTime();
                  const isLive = now >= start && now < end;
                  return (
                    <li key={schedule.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                        <Radio className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                          {schedule.title_bn}
                        </p>
                        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                          {schedule.course?.title_bn ?? "—"} · {formatDate(schedule.starts_at)} ·{" "}
                          {formatTime(schedule.starts_at)}–{formatTime(schedule.ends_at)}
                        </p>
                      </div>
                      {isLive ? (
                        <LiveDot label="চলছে" />
                      ) : (
                        <Badge tone="neutral">{formatNumber(schedule.question_count)} প্রশ্ন</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function RoutinePreview({ routines }: { routines: Routine[] }) {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)] py-14 sm:py-16" aria-labelledby="routine-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              স্টাডি রুটিন
            </p>
            <h2 id="routine-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
              দিনভিত্তিক পড়ার পরিকল্পনা
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              প্রতিদিনের রুটিনে বিষয় ও টপিক নির্ধারিত থাকে। রুটিন সংরক্ষণ করলেও পরীক্ষা স্বয়ংক্রিয়ভাবে
              প্রকাশ পায় না — শুধু শিশু-প্রশ্নসহ প্রকাশিত পরীক্ষাই অংশগ্রহণের জন্য খোলে।
            </p>
          </div>
          <ButtonLink href="/routines" variant="secondary" size="md">
            পুরো রুটিন দেখুন
            <ArrowRight className="size-3.5" aria-hidden />
          </ButtonLink>
        </div>

        {routines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-10 text-center">
            <Clock3 className="mx-auto size-7 text-[var(--text-subtle)]" aria-hidden />
            <p className="mt-3 text-[0.875rem] font-semibold text-[var(--text)]">এখনো কোনো প্রকাশিত রুটিন নেই</p>
            <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              প্রশাসক রুটিন তৈরি ও প্রকাশ করলে এখানে দিনভিত্তিক পরিকল্পনা দেখা যাবে।
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routines.slice(0, 6).map((routine) => (
              <div key={routine.id} className="jh-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    {formatDate(routine.routine_date)}
                  </span>
                  <Badge tone={routine.kind === "weekly_special" ? "accent" : "brand"}>
                    {routine.kind === "weekly_special" ? "সাপ্তাহিক" : "দৈনিক"}
                  </Badge>
                </div>
                <p className="mt-2 text-[0.875rem] font-semibold text-[var(--text)]">
                  {routine.title_bn || routine.topic_title_bn || routine.subject_title_bn || "পড়ার পরিকল্পনা"}
                </p>
                <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
                  {routine.subject_title_bn ?? "—"} {routine.topic_title_bn ? `· ${routine.topic_title_bn}` : ""}
                </p>
                {routine.subtopic_title_bn ? (
                  <p className="mt-1 text-[0.6875rem] text-[var(--brand)]">
                    সাবটপিক: {routine.subtopic_title_bn}
                  </p>
                ) : null}
                <p className="mt-3 inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                  <Clock3 className="size-3" aria-hidden />
                  {formatNumber(routine.minutes)} মিনিট
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "যাচাইকৃত প্রশ্নব্যাংক",
    description:
      "প্রতিটি প্রশ্ন খসড়া থেকে পর্যালোচনা হয়ে অনুমোদিত হয়। AI-সহায়তায় তৈরি প্রশ্ন স্বয়ংক্রিয়ভাবে যাচাইকৃত হয় না।",
  },
  {
    icon: Zap,
    title: "দ্রুত ও নির্ভরযোগ্য পরীক্ষার ইন্টারফেস",
    description:
      "প্রশ্ন গ্রিড, মার্ক-ফর-রিভিউ, কীবোর্ড শর্টকাট এবং উত্তরের অটো-সেভ — মোবাইলেও বড় ও স্পর্শবান্ধব।",
  },
  {
    icon: Timer,
    title: "সার্ভার-নিয়ন্ত্রিত সময়",
    description:
      "সময় শেষ হওয়া, দ্বিগুণ সাবমিশন এবং অননুমোদিত ফলাফল প্রকাশ সার্ভারেই নিয়ন্ত্রিত হয়।",
  },
  {
    icon: LineChart,
    title: "বাস্তব অ্যানালিটিক্স",
    description:
      "আপনার জমা দেওয়া পরীক্ষার প্রকৃত তথ্য থেকে বিষয় ও টপিকভিত্তিক নির্ভুলতা এবং দুর্বল টপিক চিহ্নিতকরণ।",
  },
  {
    icon: BookOpenCheck,
    title: "কাস্টম ও প্র্যাকটিস মোড",
    description:
      "বিষয়, টপিক বা সাবটপিক বেছে নিয়ে প্রশ্নসংখ্যা ও সময় নির্ধারণ করে পরীক্ষা তৈরি করুন।",
  },
  {
    icon: Sparkles,
    title: "শিক্ষার্থী-প্রথম নকশা",
    description:
      "পরিষ্কার টাইপোগ্রাফি, বাংলা-বান্ধব ফন্ট, লাইট ও ডার্ক মোড এবং কোনো অনুভূমিক স্ক্রল ছাড়াই ব্যবহারযোগ্য।",
  },
];

export function LearningFeatures() {
  return (
    <section className="border-b border-[var(--border)] py-14 sm:py-16" aria-labelledby="features-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            শেখার অভিজ্ঞতা
          </p>
          <h2 id="features-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
            পরীক্ষার দিনের চাপ, প্রস্তুতির সময়েই দূর করুন
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="jh-card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3.5 text-[0.9375rem] font-semibold text-[var(--text)]">{feature.title}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "অ্যাকাউন্ট ও লক্ষ্য নির্ধারণ",
    description: "রেজিস্ট্রেশন করে আপনার লক্ষ্য কোর্স বেছে নিন। সিলেবাস ও রুটিন সেই অনুযায়ী সাজানো হবে।",
  },
  {
    title: "রুটিন অনুযায়ী প্রস্তুতি",
    description: "দিনভিত্তিক বিষয় ও টপিক অনুসরণ করুন, প্র্যাকটিস সেন্টারে অনুশীলন করুন।",
  },
  {
    title: "লাইভ পরীক্ষা ও বিশ্লেষণ",
    description: "নির্ধারিত সময়ে লাইভ পরীক্ষা দিন। ফলাফল প্রকাশের পর ব্যাখ্যা ও দুর্বল টপিক বিশ্লেষণ দেখুন।",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)] py-14 sm:py-16" aria-labelledby="how-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            কীভাবে কাজ করে
          </p>
          <h2 id="how-heading" className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
            তিন ধাপে শৃঙ্খলাবদ্ধ প্রস্তুতি
          </h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative jh-card p-5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(150deg,var(--brand),var(--accent))] text-[0.8125rem] font-bold text-white">
                {formatNumber(index + 1)}
              </span>
              <h3 className="mt-3.5 text-[0.9375rem] font-semibold text-[var(--text)]">{step.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ExamIntegrity() {
  const points = [
    {
      icon: ShieldCheck,
      title: "প্রশ্ন আসে যাচাইয়ের পরই",
      text: "প্রতিটি প্রশ্ন সম্পাদকীয় পর্যালোচনা পেরিয়ে অনুমোদিত হয়। অনুমোদন ছাড়া কোনো প্রশ্ন কোনো পরীক্ষায় আসে না।",
    },
    {
      icon: Timer,
      title: "সময় নিয়ন্ত্রণ করে সার্ভার",
      text: "পরীক্ষার সময়সীমা সার্ভারেই নির্ধারিত ও গণনা করা হয় — ডিভাইসের ঘড়ি বা পেজ রিফ্রেশ বদলাতে পারে না।",
    },
    {
      icon: Target,
      title: "স্কোরিং স্বয়ংক্রিয় ও নিরপেক্ষ",
      text: "সঠিক উত্তরে পূর্ণ নম্বর, ভুলে নির্ধারিত কাটতি, না দিলে শূন্য — ফলাফল আপনার আসল উত্তরের ভিত্তিতেই।",
    },
  ];

  return (
    <section className="border-b border-[var(--border)] py-14 sm:py-16" aria-labelledby="integrity-heading">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="jh-enter order-2 lg:order-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              পরীক্ষার নির্ভরযোগ্যতা
            </p>
            <h2
              id="integrity-heading"
              className="mt-2 text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]"
            >
              যে পরীক্ষায় ফলাফল নিয়ে সন্দেহ থাকে না
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              প্রতিযোগিতামূলক পরীক্ষায় এক নম্বরও গুরুত্বপূর্ণ। তাই প্রশ্ন বাছাই, সময় নিয়ন্ত্রণ ও
              স্কোরিং — সবকিছু স্বয়ংক্রিয়ভাবে এবং যাচাইযোগ্যভাবে সম্পন্ন হয়।
            </p>

            <ul className="mt-7 space-y-4">
              {points.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <point.icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[0.875rem] font-semibold text-[var(--text)]">{point.title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                      {point.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="jh-enter order-1 lg:order-2" style={{ animationDelay: "80ms" }}>
            <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] shadow-[0_24px_60px_-28px_rgba(79,66,228,0.3)]">
              <Image
                src="/exam-hall-bd.jpg"
                alt="আধুনিক পরীক্ষা কক্ষে শিক্ষার্থীরা কম্পিউটারে পরীক্ষা দিচ্ছেন"
                width={1408}
                height={768}
                sizes="(max-width: 1024px) 100vw, 36rem"
                className="h-auto w-full object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-[var(--surface)]/95 px-3 py-2 shadow-lg backdrop-blur">
                <ShieldCheck className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                <p className="text-[0.6875rem] font-medium leading-snug text-[var(--text-muted)]">
                  সময়, প্রশ্ন ও নম্বর — সব সার্ভারে যাচাই হয়
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="jh-hero-field jh-card relative overflow-hidden p-8 text-center sm:p-12">
          <div className="jh-grid-lines pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[0.6875rem] font-semibold text-[var(--text-muted)]">
              <Play className="size-3 text-[var(--brand)]" aria-hidden />
              আজই শুরু করুন
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-balance text-[1.5rem] font-bold tracking-[-0.03em] text-[var(--text)] sm:text-[2rem]">
              আপনার পরবর্তী চাকরির প্রস্তুতি, আরও পরিষ্কারভাবে
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              বিনামূল্যে অ্যাকাউন্ট খুলুন, আপনার লক্ষ্য কোর্স বেছে নিন, এবং আজ থেকেই যাচাইকৃত প্রশ্নে
              অনুশীলন শুরু করুন।
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={signedIn ? "/dashboard" : "/register"} size="lg">
                {signedIn ? "ড্যাশবোর্ড" : "বিনামূল্যে অ্যাকাউন্ট"}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/courses" variant="secondary" size="lg">
                কোর্স ক্যাটালগ
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
