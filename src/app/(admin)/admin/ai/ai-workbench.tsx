"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Sparkles, TriangleAlert, Upload, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

type Taxonomy = {
  subjects: { id: string; title_bn: string }[];
  topics: { id: string; subject_id: string; title_bn: string }[];
};

type GeneratedRow = {
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  difficulty: string;
  subject: string;
  topic: string;
};

type ImportPreview = {
  toInsert: number;
  valid: number;
  invalid: number;
  duplicatesInDb: number;
  duplicatesInFile: number;
};

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"] as const;

export function AiWorkbench({
  courses,
  configured,
}: {
  courses: { id: string; title_bn: string }[];
  configured: boolean;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [taxonomy, setTaxonomy] = React.useState<Taxonomy>({ subjects: [], topics: [] });
  const [subjectId, setSubjectId] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [count, setCount] = React.useState(10);
  const [difficulty, setDifficulty] = React.useState<"mixed" | "easy" | "medium" | "hard">("mixed");
  const [instructions, setInstructions] = React.useState("");

  const [rows, setRows] = React.useState<GeneratedRow[]>([]);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [setup, setSetup] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/admin/taxonomy?courseId=${courseId}`);
        const payload = (await response.json()) as Taxonomy;
        if (!cancelled) {
          setTaxonomy({ subjects: payload.subjects ?? [], topics: payload.topics ?? [] });
          setSubjectId("");
          setTopicId("");
        }
      } catch {
        if (!cancelled) setTaxonomy({ subjects: [], topics: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const subject = taxonomy.subjects.find((s) => s.id === subjectId) ?? null;
  const topics = taxonomy.topics.filter((t) => t.subject_id === subjectId);
  const topic = topics.find((t) => t.id === topicId) ?? null;
  const course = courses.find((c) => c.id === courseId) ?? null;

  async function generate() {
    if (!course || !subject) {
      setError("কোর্স ও বিষয় নির্বাচন করুন।");
      return;
    }
    setGenerating(true);
    setError(null);
    setSetup(null);
    setDone(null);
    setPreview(null);
    try {
      const response = await fetch("/api/admin/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: course.title_bn,
          subjectLabel: subject.title_bn,
          topicLabel: topic?.title_bn ?? "",
          count,
          difficulty,
          instructions: instructions || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "AI প্রশ্ন তৈরি ব্যর্থ হয়েছে।");
        if (payload.setup) setSetup(payload.setup as string);
        return;
      }
      setRows(payload.rows as GeneratedRow[]);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setGenerating(false);
    }
  }

  async function runImport(mode: "dry_run" | "commit") {
    if (rows.length === 0) return;
    if (mode === "dry_run") setChecking(true);
    else setCommitting(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          format: "json",
          mode,
          filename: `ai-draft-${Date.now()}.json`,
          content: JSON.stringify(rows),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রক্রিয়া ব্যর্থ হয়েছে।");
        return;
      }
      if (mode === "dry_run") {
        setPreview(payload as ImportPreview);
      } else {
        setDone(payload.message ?? `${payload.inserted}টি প্রশ্ন রিভিউ কিউতে যোগ হয়েছে।`);
        setRows([]);
        setPreview(null);
        router.refresh();
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setChecking(false);
      setCommitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div className="jh-card p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="ai-course" className="jh-label">কোর্স</label>
              <select id="ai-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="jh-select">
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>{item.title_bn}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ai-subject" className="jh-label">বিষয়</label>
              <select
                id="ai-subject"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setTopicId("");
                }}
                className="jh-select"
              >
                <option value="">নির্বাচন করুন…</option>
                {taxonomy.subjects.map((item) => (
                  <option key={item.id} value={item.id}>{item.title_bn}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ai-topic" className="jh-label">টপিক (ঐচ্ছিক)</label>
              <select
                id="ai-topic"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="jh-select"
                disabled={!subjectId}
              >
                <option value="">পুরো বিষয়</option>
                {topics.map((item) => (
                  <option key={item.id} value={item.id}>{item.title_bn}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ai-count" className="jh-label">কতটি প্রশ্ন</label>
                <Input
                  id="ai-count"
                  type="number"
                  min={1}
                  max={25}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <label htmlFor="ai-difficulty" className="jh-label">কঠিনতা</label>
                <select
                  id="ai-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className="jh-select"
                >
                  <option value="mixed">মিশ্র</option>
                  <option value="easy">সহজ</option>
                  <option value="medium">মধ্যম</option>
                  <option value="hard">কঠিন</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="ai-instructions" className="jh-label">অতিরিক্ত নির্দেশনা (ঐচ্ছিক)</label>
            <Textarea
              id="ai-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="যেমন: বিগত বিসিএস প্রশ্নের ধাঁচে, সাল-তারিখভিত্তিক প্রশ্ন বেশি…"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={generate} loading={generating} disabled={!configured || !subjectId}>
              {!generating ? <Wand2 className="size-3.5" aria-hidden /> : null}
              প্রশ্ন তৈরি করুন
            </Button>
            {rows.length > 0 ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => runImport("dry_run")} loading={checking}>
                  {!checking ? <CheckCheck className="size-3.5" aria-hidden /> : null}
                  যাচাই (ডুপ্লিকেট চেক)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runImport("commit")}
                  loading={committing}
                  disabled={!preview || preview.toInsert === 0}
                >
                  {!committing ? <Upload className="size-3.5" aria-hidden /> : null}
                  রিভিউ কিউতে পাঠান
                </Button>
              </>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {error}
                {setup ? <span className="mt-1 block font-normal">{setup}</span> : null}
              </span>
            </p>
          ) : null}
          {done ? (
            <p role="status" className="mt-2 rounded-lg bg-mint-50 px-3 py-2 text-[0.75rem] font-medium text-mint-800 dark:bg-mint-600/10 dark:text-mint-300">
              {done} — <a href="/admin/review" className="underline">রিভিউ কিউতে দেখুন</a>
            </p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="jh-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
              <h2 className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--text)]">
                <Sparkles className="size-3.5 text-[var(--brand)]" aria-hidden />
                খসড়া প্রশ্ন ({formatNumber(rows.length)}টি)
              </h2>
              <Badge tone="warning">অনুমোদনের আগে ব্যবহার হবে না</Badge>
            </div>
            <ul className="max-h-[32rem] divide-y divide-[var(--border)] overflow-y-auto">
              {rows.map((row, index) => (
                <li key={index} className="px-4 py-3">
                  <p className="font-bangla text-[0.8125rem] font-medium leading-[1.7] text-[var(--text)]">
                    {formatNumber(index + 1)}. {row.statement}
                  </p>
                  <div className="mt-1.5 grid gap-1 text-[0.75rem] text-[var(--text-muted)] sm:grid-cols-2">
                    {[row.option_a, row.option_b, row.option_c, row.option_d].map((option, optIndex) => {
                      const isCorrect = ["A", "B", "C", "D"][optIndex] === row.correct_option;
                      return (
                        <p key={optIndex} className={isCorrect ? "font-semibold text-mint-700 dark:text-mint-400" : ""}>
                          {OPTION_KEYS[optIndex]}. {option} {isCorrect ? "✓" : ""}
                        </p>
                      );
                    })}
                  </div>
                  {row.explanation ? (
                    <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">{row.explanation}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <aside className="space-y-3">
        <div className="jh-card p-4">
          <h2 className="text-[0.75rem] font-semibold text-[var(--text)]">কীভাবে কাজ করে</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            <li>বিষয়/টপিক বেছে AI দিয়ে খসড়া তৈরি করুন।</li>
            <li>খসড়া পড়ে দেখুন — ভুল মনে হলে আবার জেনারেট করুন।</li>
            <li>&ldquo;যাচাই&rdquo; চাপলে ডুপ্লিকেট চেক হয়।</li>
            <li>&ldquo;রিভিউ কিউতে পাঠান&rdquo; — প্রশ্ন pending_review হয়ে ঢোকে।</li>
            <li>রিভিউ কিউ থেকে আপনি নিজে অনুমোদন/বাতিল করবেন।</li>
          </ol>
        </div>
        {preview ? (
          <div className="jh-card p-4">
            <h2 className="text-[0.75rem] font-semibold text-[var(--text)]">যাচাইয়ের ফলাফল</h2>
            <dl className="mt-2 space-y-1.5 text-[0.6875rem]">
              {[
                ["বৈধ", formatNumber(preview.valid)],
                ["অবৈধ", formatNumber(preview.invalid)],
                ["ডেটাবেসে আগে থেকেই আছে", formatNumber(preview.duplicatesInDb)],
                ["যোগ হবে", formatNumber(preview.toInsert)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-[var(--text-subtle)]">{label}</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
