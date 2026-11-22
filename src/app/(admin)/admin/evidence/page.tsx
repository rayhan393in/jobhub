import type { Metadata } from "next";
import { FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listCourses } from "@/lib/queries";
import { AdminNote, AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";
import { formatNumber } from "@/lib/format";
import { EvidenceVerifier } from "./evidence-verifier";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "এভিডেন্স ভেরিফায়ার" };

export type EvidenceRow = {
  id: string;
  question_id: string;
  exam_name: string;
  exam_year: number;
  match_kind: "exact" | "same_concept" | "related";
  source_ref: string | null;
  source_url: string | null;
  verified_at: string;
};

export type PreviousQuestion = {
  id: string;
  course_id: string;
  statement: string;
  exam_name: string | null;
  year: number | null;
  status: string;
  evidence: EvidenceRow[];
};

/**
 * Evidence Verifier.
 *
 * A question only counts as a confirmed previous-year question when a human
 * has recorded WHICH exam and WHICH year it appeared in. This page is where
 * that happens — one question at a time, or in bulk from the CSV template.
 * Questions whose `exam_name`/`year` columns are empty stay visibly
 * unverified; nothing here guesses a year from the question text.
 */
export default async function EvidencePage() {
  await requirePermission("question.review");
  const courses = await listCourses();

  let questions: PreviousQuestion[] = [];
  let coverage: Array<{ course: string; previous_questions: number; questions_with_evidence: number; coverage_pct: number | null }> = [];

  if (isSupabaseConfigured) {
    const supabase = getAdminClient();

    const [{ data: questionRows }, { data: coverageRows }] = await Promise.all([
      supabase
        .from("questions")
        .select("id, course_id, statement, exam_name, year, status")
        .eq("source_type", "previous")
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("v_evidence_coverage").select("course, previous_questions, questions_with_evidence, coverage_pct"),
    ]);

    const base = (questionRows ?? []) as Array<Omit<PreviousQuestion, "evidence">>;
    const ids = base.map((question) => question.id);
    const evidenceByQuestion = new Map<string, EvidenceRow[]>();
    if (ids.length > 0) {
      const { data: evidenceRows } = await supabase
        .from("evidence_records")
        .select("id, question_id, exam_name, exam_year, match_kind, source_ref, source_url, verified_at")
        .in("question_id", ids)
        .order("exam_year", { ascending: false });
      for (const record of (evidenceRows ?? []) as EvidenceRow[]) {
        const list = evidenceByQuestion.get(record.question_id) ?? [];
        list.push(record);
        evidenceByQuestion.set(record.question_id, list);
      }
    }
    questions = base.map((question) => ({ ...question, evidence: evidenceByQuestion.get(question.id) ?? [] }));
    coverage = (coverageRows ?? []) as typeof coverage;
  }

  const totalPrevious = questions.length;
  const withEvidence = questions.filter((question) => question.evidence.length > 0).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="ডেটা কোয়ালিটি"
        title="এভিডেন্স ভেরিফায়ার"
        description="বিগত বছরের প্রশ্নের প্রতিটি দাবি কোন পরীক্ষায়, কোন সালে — তার যাচাইকৃত রেকর্ড। এভিডেন্স ছাড়া কোনো প্রশ্ন নিশ্চিত বিগত-বছরের প্রশ্ন হিসেবে প্রকাশিত হয় না।"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat icon={<FileCheck2 className="h-4 w-4" />} label="বিগত-বছর ট্যাগযুক্ত প্রশ্ন" value={formatNumber(totalPrevious)} />
        <MiniStat icon={<ShieldCheck className="h-4 w-4" />} label="এভিডেন্সসহ যাচাইকৃত" value={formatNumber(withEvidence)} />
        <MiniStat
          icon={<ShieldAlert className="h-4 w-4" />}
          label="এভিডেন্সবিহীন (পেন্ডিং)"
          value={formatNumber(totalPrevious - withEvidence)}
          hint="এগুলো অযাচাইকৃত অবস্থায় থাকবে"
        />
      </div>

      <AdminNote>
        সাল বা পরীক্ষার নাম প্রশ্নের টেক্সট থেকে অনুমান করা হয় না। CSV-তে exam_name ও exam_year উভয়টি বাধ্যতামূলক;
        যেকোনো অনুপস্থিত মান সারিটিকে বাতিল করে এবং রিপোর্টে দেখায়।
      </AdminNote>

      <EvidenceVerifier
        courses={courses.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
        questions={questions}
        coverage={coverage}
      />
    </div>
  );
}
