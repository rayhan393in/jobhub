"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, Flame, Medal, Trophy, Info } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { LeaderboardRow } from "@/lib/types";

type Scope = "daily" | "weekly" | "course" | "exam";

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: "daily", label: "আজকের", hint: "আজকের প্রকাশিত ফলাফল" },
  { id: "weekly", label: "সাপ্তাহিক", hint: "এই সপ্তাহের প্রকাশিত ফলাফল" },
  { id: "course", label: "কোর্স", hint: "নির্বাচিত কোর্সের সব ফলাফল" },
  { id: "exam", label: "পরীক্ষা", hint: "একটি নির্দিষ্ট পরীক্ষা" },
];

export function LeaderboardClient({
  initialRows,
  courses,
  exams,
  currentUserId,
}: {
  initialRows: LeaderboardRow[];
  courses: { id: string; slug: string; title_bn: string }[];
  exams: { id: string; title_bn: string }[];
  currentUserId: string | null;
}) {
  const [scope, setScope] = React.useState<Scope>("daily");
  const [courseId, setCourseId] = React.useState<string>(courses[0]?.id ?? "");
  const [scheduleId, setScheduleId] = React.useState<string>(exams[0]?.id ?? "");
  const [rows, setRows] = React.useState<LeaderboardRow[]>(initialRows);
  const [loading, setLoading] = React.useState(false);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ scope });
    if (scope === "course" && courseId) params.set("courseId", courseId);
    if (scope === "exam") {
      if (!scheduleId) {
        setRows([]);
        return () => controller.abort();
      }
      params.set("scheduleId", scheduleId);
    }
    // `await` before the first setState keeps this an async subscription, not a
    // render-cascading effect.
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/leaderboard?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = response.ok ? await response.json() : { rows: [] };
        setRows(payload.rows ?? []);
      } catch {
        /* aborted or offline — keep the previous list */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [scope, courseId, scheduleId]);

  const podium = scope === "daily" || scope === "weekly" ? rows.slice(0, 3) : [];
  const rest = scope === "daily" || scope === "weekly" ? rows.slice(3) : rows;
  const myRank = currentUserId ? rows.find((r) => r.user_id === currentUserId) : undefined;

  return (
    <div>
      <div className="jh-card mb-4 flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Leaderboard scope">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id}
              onClick={() => setScope(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold transition-colors",
                scope === item.id
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {scope === "course" ? (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Course"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--text)]"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title_bn}
                </option>
              ))}
            </select>
          ) : null}
          {scope === "exam" ? (
            <select
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              aria-label="Exam"
              className="max-w-[16rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--text)]"
            >
              {exams.length === 0 ? <option value="">কোনো পরীক্ষা নেই</option> : null}
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title_bn}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <p className="mb-3 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        শুধু প্রকাশিত ফলাফল গণনা হয়। র‍্যাংক নির্ধারণ: প্রাপ্ত নম্বর → নির্ভুলতা → আগে জমা দেওয়া। তিনটিই সমান
        হলে একই র‍্যাংক দেওয়া হয়। শীর্ষ ৫ জন হাইলাইট করা হয়। নাম ছাড়া কেউ তালিকায় আসে না।
      </p>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="jh-skeleton h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-5" />}
          title="এখনো কোনো প্রকাশিত ফলাফল নেই"
          description={
            scope === "daily"
              ? "আজ কোনো প্রকাশিত ফলাফল নেই। প্রকাশিত ফলাফল থাকলে লিডারবোর্ড তৈরি হবে — কোনো নমুনা তালিকা দেখানো হয় না।"
              : "এই স্কোপে এখন প্রকাশিত ফলাফল নেই। পরীক্ষা দিয়ে জমা দেওয়ার পর ফলাফল প্রকাশের সময় এখানে দেখা যাবে।"
          }
        />
      ) : (
        <>
          {podium.length > 0 ? (
            <div className="mb-4 grid gap-2.5 sm:grid-cols-3">
              {[1, 0, 2].map((index) => {
                const row = podium[index];
                if (!row) return <div key={index} />;
                const style = [
                  { ring: "border-amber-300 bg-amber-50 dark:bg-amber-500/10", icon: <Crown className="size-4 text-amber-500" /> },
                  { ring: "border-slate-300 bg-slate-50 dark:bg-slate-500/10", icon: <Medal className="size-4 text-slate-400" /> },
                  { ring: "border-orange-300 bg-orange-50 dark:bg-orange-500/10", icon: <Medal className="size-4 text-orange-500" /> },
                ][row.rank === 1 ? 0 : row.rank === 2 ? 1 : 2];
                return (
                  <div
                    key={row.user_id}
                    className={cn(
                      "rounded-2xl border p-4 text-center",
                      style.ring,
                      row.rank === 1 && "sm:-mt-1 sm:pb-5",
                    )}
                  >
                    <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-white shadow-sm dark:bg-[var(--surface)]">
                      {style.icon}
                    </span>
                    <p className="mt-2 truncate text-[0.8125rem] font-bold text-[var(--text)]">{row.full_name}</p>
                    <p className="mt-0.5 text-[1.25rem] font-extrabold tabular-nums leading-none text-[var(--text)]">
                      {formatNumber(row.score)}
                    </p>
                    <p className="mt-1.5 text-[0.625rem] text-[var(--text-subtle)]">
                      {formatPercent(row.accuracy)} · {formatNumber(row.duration_seconds ? Math.round(row.duration_seconds / 60) : 0)} মিনিট
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          <ol className="jh-card divide-y divide-[var(--border)] overflow-hidden">
            {rest.map((row) => {
              const isMe = row.user_id === currentUserId;
              const isTop5 = row.rank <= 5;
              return (
                <li
                  key={`${row.user_id}-${row.rank}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    isTop5 && "bg-amber-50/70 dark:bg-amber-500/[0.07]",
                    isMe && "bg-[var(--brand-soft)]",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 text-center text-[0.75rem] font-bold tabular-nums",
                      isTop5 ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-subtle)]",
                    )}
                  >
                    {formatNumber(row.rank)}
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[0.625rem] font-bold text-[var(--text-muted)]">
                    {row.full_name.trim().charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[var(--text)]">
                    {row.full_name}
                    {isMe ? <span className="ml-1.5 text-[0.625rem] font-semibold text-[var(--brand)]">(আপনি)</span> : null}
                    {isTop5 ? (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.5625rem] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        টপ ৫
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--text-subtle)]">
                    {formatPercent(row.accuracy)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-[0.8125rem] font-bold tabular-nums text-[var(--text)]">
                    {formatNumber(row.score)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {myRank ? (
        <div className="mt-4 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--text)]">
              <Flame className="size-3.5 text-[var(--brand)]" aria-hidden />
              আপনার অবস্থান: {formatNumber(myRank.rank)}
            </p>
            <Link href="/analytics" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
              বিস্তারিত
            </Link>
          </div>
          <Progress
            value={Math.max(4, 100 - (myRank.rank / Math.max(1, rows.length)) * 100)}
            className="mt-2"
            label="Your rank"
          />
          <p className="mt-1.5 text-[0.625rem] text-[var(--text-muted)]">
            {formatNumber(myRank.score)} নম্বর · {formatPercent(myRank.accuracy)} নির্ভুলতা ·{" "}
            {formatTime(myRank.submitted_at ?? undefined)}
          </p>
        </div>
      ) : currentUserId ? (
        <p className="mt-4 rounded-xl bg-[var(--surface-muted)] px-3.5 py-2.5 text-[0.6875rem] text-[var(--text-muted)]">
          এই তালিকায় আপনার নাম নেই। পরীক্ষা দিয়ে জমা দিলে এবং ফলাফল প্রকাশিত হলে আপনি তালিকায় যুক্ত হবেন।
        </p>
      ) : null}
    </div>
  );
}
