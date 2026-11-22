"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MergeRecord } from "./page";

const STATUS_META: Record<MergeRecord["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  proposed: { label: "প্রস্তাবিত", tone: "warning" },
  applied: { label: "প্রয়োগকৃত", tone: "success" },
  rejected: { label: "বাতিল", tone: "danger" },
  reverted: { label: "ফেরানো হয়েছে", tone: "neutral" },
};

type Filter = "proposed" | "applied" | "all";

export function MergeReview({ merges }: { merges: MergeRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("proposed");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [titles, setTitles] = React.useState<Record<string, string>>({});

  const visible = merges.filter((merge) =>
    filter === "all" ? true : merge.status === filter,
  );

  async function act(action: "approve" | "reject" | "revert", merge: MergeRecord) {
    if (action === "revert" && !window.confirm("লিংকটি ফেরালে টপিকগুলো আবার আলাদা গণনা হবে। নিশ্চিত?")) return;
    setBusy(`${action}-${merge.id}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: merge.id,
          canonicalTitle: titles[merge.id] || merge.members[0]?.topic_title || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "অনুরোধ ব্যর্থ হয়েছে।");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "অনুরোধ ব্যর্থ হয়েছে।");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([
          ["proposed", "প্রস্তাবিত"],
          ["applied", "প্রয়োগকৃত"],
          ["all", "সব"],
        ] as Array<[Filter, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-[0.6875rem] font-medium transition ${
              filter === key
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-[0.6875rem] text-[var(--text-subtle)]">{visible.length} টি রেকর্ড</span>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-700">{error}</p>
      ) : null}

      <ul className="space-y-3">
        {visible.map((merge) => {
          const meta = STATUS_META[merge.status];
          return (
            <li key={merge.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <Badge tone="neutral">{merge.kind === "topic" ? "টপিক" : "বিষয়"}</Badge>
                {merge.canonical_title ? (
                  <span className="text-[0.8125rem] font-semibold text-[var(--text)]">{merge.canonical_title}</span>
                ) : null}
                <span className="ml-auto text-[0.625rem] text-[var(--text-subtle)]">
                  প্রভাবিত: {merge.affected_questions} প্রশ্ন · {merge.affected_routines} রুটিন
                </span>
              </div>

              {merge.reason ? (
                <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">{merge.reason}</p>
              ) : null}

              <ul className="mt-2 flex flex-wrap gap-1.5">
                {merge.members.map((member) => (
                  <li
                    key={member.topic_id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[0.6875rem] text-[var(--text-muted)]"
                  >
                    <span className="font-medium text-[var(--text)]">{member.topic_title}</span>
                    {" · "}{member.course_slug}{" · "}{member.subject_title}
                    {member.question_count > 0 ? ` · ${member.question_count} প্রশ্ন` : ""}
                  </li>
                ))}
              </ul>

              {merge.status === "proposed" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={titles[merge.id] ?? merge.members[0]?.topic_title ?? ""}
                    onChange={(event) => setTitles((previous) => ({ ...previous, [merge.id]: event.target.value }))}
                    placeholder="ক্যানোনিকাল নাম"
                    className="h-9 w-56 rounded-lg border border-[var(--border)] px-2 text-[0.75rem]"
                  />
                  <Button size="sm" loading={busy === `approve-${merge.id}`} onClick={() => act("approve", merge)}>
                    অনুমোদন (লিংক করুন)
                  </Button>
                  <Button size="sm" variant="danger" loading={busy === `reject-${merge.id}`} onClick={() => act("reject", merge)}>
                    বাতিল (আলাদাই থাক)
                  </Button>
                </div>
              ) : null}

              {merge.status === "applied" ? (
                <div className="mt-3">
                  <Button size="sm" variant="secondary" loading={busy === `revert-${merge.id}`} onClick={() => act("revert", merge)}>
                    রোলব্যাক — লিংক ফেরান
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-[0.75rem] text-[var(--text-subtle)]">
            এই ফিল্টারে কোনো রেকর্ড নেই।
          </li>
        ) : null}
      </ul>
    </div>
  );
}
