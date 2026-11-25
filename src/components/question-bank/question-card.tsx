import { Badge } from "@/components/ui/badge";
import { SinglePracticeButton } from "@/components/question-bank/practice-buttons";
import type { PyqQuestion } from "@/lib/question-bank";
import { formatNumber } from "@/lib/format";

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];
const DIFFICULTY: Record<string, { label: string; tone: "neutral" | "warning" | "danger" | "success" }> = {
  easy: { label: "সহজ", tone: "success" },
  medium: { label: "মধ্যম", tone: "warning" },
  hard: { label: "কঠিন", tone: "danger" },
};

/**
 * One verified previous-year question. The correct option and explanation are
 * deliberately absent — they only reach the browser through an attempt's
 * review screen after submission.
 */
export function QuestionCard({ question, number }: { question: PyqQuestion; number: number }) {
  const difficulty = DIFFICULTY[question.difficulty] ?? DIFFICULTY.medium;
  const statement = question.statement_bn?.trim() ? question.statement_bn : question.statement;

  return (
    <li className="jh-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 select-none items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[0.8125rem] font-extrabold text-[var(--brand)]"
        >
          {formatNumber(number)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {question.exam_name ? (
              <Badge tone="brand">
                {question.exam_name}
                {question.year ? ` · ${formatNumber(question.year)}` : ""}
              </Badge>
            ) : null}
            <Badge tone="success">যাচাইকৃত PYQ</Badge>
            <Badge tone={difficulty.tone}>{difficulty.label}</Badge>
            {question.question_type === "written" ? <Badge tone="info">লিখিত</Badge> : <Badge tone="neutral">MCQ</Badge>}
          </div>

          <p className="mt-2.5 font-bangla text-[0.9375rem] font-medium leading-[1.75] text-[var(--text)]">
            {statement}
          </p>

          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {question.options.map((option, index) => (
              <li
                key={index}
                className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              >
                <span className="mt-0.5 flex size-5 shrink-0 select-none items-center justify-center rounded-md border border-[var(--border-strong)] text-[0.625rem] font-bold text-[var(--text-muted)]">
                  {OPTION_KEYS[index]}
                </span>
                <span className="min-w-0 text-[0.8125rem] leading-snug text-[var(--text)]">{option}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-[var(--text-subtle)]">
            {question.subject_title ? <span>বিষয়: <span className="font-semibold text-[var(--text-muted)]">{question.subject_title}</span></span> : null}
            {question.topic_title ? <span>টপিক: <span className="font-semibold text-[var(--text-muted)]">{question.topic_title}</span></span> : null}
            {question.subtopic_title ? <span>সাবটপিক: <span className="font-semibold text-[var(--text-muted)]">{question.subtopic_title}</span></span> : null}
            {question.exam_name ? (
              <span>
                পরীক্ষা: <span className="font-semibold text-[var(--text-muted)]">{question.exam_name}</span>
                {question.year ? ` (${question.year})` : ""}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <p className="text-[0.625rem] leading-snug text-[var(--text-subtle)]">
              {question.has_explanation
                ? "ব্যাখ্যা সংযুক্ত — অনুশীলনের পরে দেখা যাবে।"
                : "এ প্রশ্নের ব্যাখ্যা এখনো সংযুক্ত নেই।"}
            </p>
            <SinglePracticeButton questionId={question.id} />
          </div>
        </div>
      </div>
    </li>
  );
}
