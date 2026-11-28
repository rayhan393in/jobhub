import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { getServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { MarksEditor, type MarksCourse, type MarksRowDraft } from "./marks-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "নম্বর বিভাজন" };

export default async function MarksAdminPage() {
  await requirePermission("taxonomy.manage");
  const supabase = await getServerClient();

  let courses: MarksCourse[] = [];
  let rowCount = 0;

  if (supabase) {
    const [{ data: courseRows }, { data: markRows }, { data: subjectRows }] = await Promise.all([
      supabase.from("courses").select("id, slug, title_bn, sort_order").order("sort_order"),
      supabase
        .from("exam_marks")
        .select(
          "id, course_id, stage, stage_bn, paper_bn, question_count, marks_per_question, negative_marks, duration_minutes, total_marks, pass_marks, note_bn, sort_order",
        )
        .order("sort_order"),
      supabase.from("subjects").select("course_id, weight, is_active"),
    ]);

    const marks = markRows ?? [];
    rowCount = marks.length;
    courses = (courseRows ?? []).map((course) => {
      const subjects = (subjectRows ?? []).filter((s) => s.course_id === course.id && s.is_active);
      return {
        id: course.id,
        slug: course.slug,
        title_bn: course.title_bn,
        subjectMarks: subjects.reduce((sum, s) => sum + Number(s.weight ?? 0), 0),
        rows: marks
          .filter((m) => m.course_id === course.id)
          .map<MarksRowDraft>((m) => ({
            id: m.id,
            stage: m.stage as MarksRowDraft["stage"],
            stageBn: m.stage_bn,
            paperBn: m.paper_bn ?? "",
            questionCount: m.question_count === null ? "" : String(m.question_count),
            marksPerQuestion: m.marks_per_question === null ? "" : String(Number(m.marks_per_question)),
            negativeMarks: String(Number(m.negative_marks)),
            durationMinutes: m.duration_minutes === null ? "" : String(m.duration_minutes),
            totalMarks: String(Number(m.total_marks)),
            passMarks: m.pass_marks === null ? "" : String(Number(m.pass_marks)),
            noteBn: m.note_bn ?? "",
            sortOrder: String(m.sort_order ?? 0),
          })),
      };
    });
  }

  const covered = courses.filter((course) => course.rows.length > 0).length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="নম্বর বিভাজন"
        title="পরীক্ষার ধাপভিত্তিক নম্বর"
        description="প্রিলিমিনারি / লিখিত / ভাইভা — প্রতিটি পত্রের প্রশ্নসংখ্যা, নম্বর, নেগেটিভ মার্কিং ও সময়। এখানে যা লিখবেন, পাবলিক সিলেবাস পেজে ঠিক সেটাই দেখাবে।"
        action={
          <div className="flex gap-1.5">
            <Badge tone={covered > 0 ? "success" : "warning"}>{formatNumber(covered)} কোর্সে টেবিল</Badge>
            <Badge tone="neutral">{formatNumber(rowCount)} সারি</Badge>
          </div>
        }
      />

      <AdminNote tone="warning">
        <strong>শুধু যাচাই করা সংখ্যা লিখুন।</strong> যেখানে অফিসিয়াল বিজ্ঞপ্তিতে সংখ্যা নেই, ঘরটি
        খালি রাখুন — অনুমান করা সংখ্যা প্ল্যাটফর্মে প্রদর্শিত হবে না। BCS, প্রাথমিক শিক্ষক ও NTRCA-র
        যাচাই করা বিভাজন ইতিমধ্যে দেওয়া আছে; বাকি কোর্সের ঘর খালি থাকাটাই সঠিক।
      </AdminNote>

      <div className="mt-4">
        <MarksEditor courses={courses} />
      </div>
    </div>
  );
}
