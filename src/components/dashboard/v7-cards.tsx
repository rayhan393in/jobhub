import Link from "next/link";
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Flame, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber, formatPercent } from "@/lib/format";
import type { SubjectPerformance, TopicPerformance, StudentAnalytics } from "@/lib/types";

const MASTERY_COLORS = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#6366f1"];

/**
 * বিষয়ভিত্তিক দক্ষতা (Mastery) — donut built from the student's real
 * subject-wise accuracy (jh_student_analytics). Center = attempt-weighted
 * overall accuracy. No data → honest empty state.
 */
export function MasteryCard({ subjects }: { subjects: SubjectPerformance[] }) {
  const top = subjects.slice(0, 6);
  const totalAttempted = top.reduce((a, s) => a + s.attempted, 0);
  const overall =
    totalAttempted > 0
      ? Math.round(top.reduce((a, s) => a + s.accuracy * s.attempted, 0) / totalAttempted)
      : 0;

  const shares = top.map((s) => (totalAttempted > 0 ? (s.attempted / totalAttempted) * 360 : 0));
  const offsets = shares.map((_, i) => shares.slice(0, i).reduce((a, b) => a + b, 0));
  const stops = top
    .map((_, i) => `${MASTERY_COLORS[i % MASTERY_COLORS.length]} ${offsets[i]}deg ${offsets[i] + shares[i]}deg`)
    .join(", ");

  return (
    <section className="jh-card p-4" aria-labelledby="mastery-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mastery-h" className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--text)]">
          <CheckCircle2 className="size-4 text-[var(--brand)]" aria-hidden />
          বিষয়ভিত্তিক দক্ষতা (Mastery)
        </h2>
        <Link href="/analytics" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
          বিস্তারিত দেখুন →
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="mt-4 text-[0.75rem] text-[var(--text-subtle)]">
          পরীক্ষা দিলে এখানে বিষয়ভিত্তিক সঠিকতার বিশ্লেষণ দেখা যাবে।
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div
            className="relative size-28 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
            role="img"
            aria-label="বিষয়ভিত্তিক দক্ষতা"
          >
            <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-[var(--surface)]">
              <span className="text-[1rem] font-extrabold tabular-nums text-[var(--text)]">{formatNumber(overall)}%</span>
              <span className="text-[0.5rem] font-medium text-[var(--text-subtle)]">সার্বিক সঠিকতা</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {top.map((s, i) => (
              <li key={s.title_bn} className="flex items-center gap-2 text-[0.6875rem]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: MASTERY_COLORS[i % MASTERY_COLORS.length] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-muted)]">{s.title_bn}</span>
                <span className="shrink-0 font-bold tabular-nums text-[var(--text)]">{formatNumber(Math.round(s.accuracy))}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* স্টাডি ক্যালেন্ডার ও স্ট্রিক — real attempt activity heatmap        */
/* ------------------------------------------------------------------ */

function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Study calendar + streak (V7 mockup "স্টাডি ক্যালেন্ডার ও স্ট্রিক").
 * `activity` maps Dhaka-local YYYY-MM-DD → attempt count for ~12 weeks.
 * Streak counts consecutive active days ending today (or yesterday, so a
 * streak is not "broken" before the student had a chance to study today).
 */
export function StudyCalendarCard({
  activity,
  today,
}: {
  activity: Map<string, number>;
  today: string;
}) {
  const WEEKS = 12;
  const days: { key: string; count: number }[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i -= 1) {
    const key = shiftDateKey(today, -i);
    days.push({ key, count: activity.get(key) ?? 0 });
  }

  // Current streak: walk back from today; allow today itself to be empty.
  let streak = 0;
  let cursor = activity.has(today) ? today : shiftDateKey(today, -1);
  while (activity.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  const monthPrefix = today.slice(0, 7);
  const activeThisMonth = [...activity.keys()].filter((k) => k.startsWith(monthPrefix)).length;
  const totalAttempts = [...activity.values()].reduce((a, b) => a + b, 0);

  const cellTone = (count: number) =>
    count === 0
      ? "bg-[var(--surface-muted)]"
      : count === 1
        ? "bg-violet-200 dark:bg-violet-500/30"
        : count <= 3
          ? "bg-violet-400 dark:bg-violet-500/60"
          : "bg-violet-600 dark:bg-violet-400";

  return (
    <section className="jh-card p-4" aria-label="স্টাডি ক্যালেন্ডার ও স্ট্রিক">
      <h2 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--text)]">
        <CalendarDays className="size-3.5 text-[var(--brand)]" aria-hidden />
        স্টাডি ক্যালেন্ডার ও স্ট্রিক
        <span className="font-medium text-[var(--text-subtle)]">— গত ১২ সপ্তাহের অনুশীলন</span>
      </h2>

      <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="দৈনিক অনুশীলন হিটম্যাপ">
        {days.map((day) => (
          <span
            key={day.key}
            title={`${day.key} — ${formatNumber(day.count)}টি পরীক্ষা/অনুশীলন`}
            className={cn("size-3 rounded-[3px]", cellTone(day.count), day.key === today && "ring-1 ring-[var(--brand)]")}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.6875rem] font-semibold text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3.5 text-orange-500" aria-hidden />
          {formatNumber(streak)} দিন বর্তমান স্ট্রিক
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5 text-emerald-600" aria-hidden />
          {formatNumber(activeThisMonth)} দিন এই মাসে সক্রিয়
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="size-3.5 text-[var(--brand)]" aria-hidden />
          {formatNumber(totalAttempts)}টি অনুশীলন (১২ সপ্তাহ)
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AI স্টাডি কোচ — data-driven suggestions (clearly labeled)           */
/* ------------------------------------------------------------------ */

/**
 * AI Study Coach (V7 mockup). Suggestions are deterministic and derived
 * ONLY from the student's real records (weak topics, routine completion,
 * accuracy) — no fabricated numbers; the card says so explicitly.
 */
export function AiCoachCard({
  weakTopics,
  summary,
  todayRoutineCount,
}: {
  weakTopics: TopicPerformance[];
  summary: StudentAnalytics["summary"] | undefined;
  todayRoutineCount: number;
}) {
  const tips: { text: string; href: string }[] = [];

  const worst = weakTopics[0];
  if (worst) {
    tips.push({
      text: `আপনার «${worst.title_bn}» টপিকে সঠিকতা ${formatPercent(worst.accuracy)} (${formatNumber(worst.attempted)}টি প্রশ্নে) — আজ এখানে অনুশীলনে অগ্রাধিকার দিন।`,
      href: "/practice",
    });
  }
  if (todayRoutineCount > 0) {
    tips.push({
      text: `আজকের রুটিনে ${formatNumber(todayRoutineCount)}টি কাজ রয়েছে — ধারাবাহিকতা ধরে রাখতে রুটিন অনুসরণ করুন।`,
      href: "/routines",
    });
  }
  if (summary && summary.attempts > 0) {
    tips.push(
      summary.avg_accuracy >= 75
        ? {
            text: `সার্বিক সঠিকতা ${formatPercent(summary.avg_accuracy)} — এখন কঠিন প্রশ্ন ও পূর্ণাঙ্গ মডেল টেস্টে সময় দিন।`,
            href: "/custom-exam",
          }
        : {
            text: `সার্বিক সঠিকতা ${formatPercent(summary.avg_accuracy)} — ভুল হওয়া প্রশ্নগুলো রিভিউ করলে দ্রুত উন্নতি হবে।`,
            href: "/bookmarks",
          },
    );
  }
  if (tips.length === 0) {
    tips.push({
      text: "এখনো যথেষ্ট ডেটা নেই — একটি প্র্যাকটিস পরীক্ষা দিলে কোচ আপনার জন্য ব্যক্তিগত পরামর্শ তৈরি করবে।",
      href: "/custom-exam",
    });
  }

  return (
    <section
      className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 p-4 dark:border-violet-500/20 dark:from-violet-500/10 dark:to-fuchsia-500/5"
      aria-label="AI স্টাডি কোচ"
    >
      <h2 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--text)]">
        <span className="flex size-6 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Bot className="size-3.5" aria-hidden />
        </span>
        AI স্টাডি কোচ
        <Sparkles className="size-3 text-fuchsia-500" aria-hidden />
      </h2>

      <ul className="mt-3 space-y-2">
        {tips.slice(0, 3).map((tip) => (
          <li key={tip.text} className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
            <span className="min-w-0 flex-1">
              {tip.text}{" "}
              <Link href={tip.href} className="inline-flex items-center gap-0.5 font-semibold text-[var(--brand)] hover:underline">
                শুরু করুন
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[0.625rem] text-[var(--text-subtle)]">
        পরামর্শগুলো আপনার প্রকৃত পরীক্ষার রেকর্ড ও রুটিন থেকে তৈরি — এগুলো প্রস্তুতির দিকনির্দেশনা, ভবিষ্যৎ প্রশ্নের নিশ্চয়তা নয়।
      </p>
    </section>
  );
}
