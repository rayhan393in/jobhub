import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listQuestions, type QuestionFilters } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPORT_LIMIT = 2000;
const PAGE = 100;

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV export of the question bank, honouring the table's current filters. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.edit")) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 403 });
  }

  const url = new URL(request.url);
  const p = (key: string) => url.searchParams.get(key) ?? undefined;
  const uuid = (key: string) => {
    const value = p(key);
    return value && UUID.test(value) ? value : undefined;
  };

  const base: QuestionFilters = {
    status: p("status"),
    courseId: uuid("course"),
    subjectId: uuid("subject"),
    topicId: uuid("topic"),
    subtopicId: uuid("subtopic"),
    difficulty: p("difficulty"),
    sourceType: p("source"),
    kind: p("kind"),
    examName: p("exam"),
    verified: p("verified") === "yes" || p("verified") === "no" ? (p("verified") as "yes" | "no") : undefined,
    year: p("year"),
    search: p("q"),
    sort: p("sort"),
  };

  const header = [
    "id", "statement_bn", "statement_en", "option_a", "option_b", "option_c", "option_d",
    "correct_option", "explanation", "course", "subject", "topic", "subtopic",
    "question_kind", "source_type", "exam_name", "year", "difficulty", "status",
    "is_verified", "created_at",
  ];
  const lines: string[] = [header.join(",")];

  for (let page = 1; lines.length - 1 < EXPORT_LIMIT; page++) {
    const { rows } = await listQuestions({ ...base, page, pageSize: PAGE });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (lines.length - 1 >= EXPORT_LIMIT) break;
      lines.push(
        [
          row.id,
          row.statement_bn ?? "",
          row.statement ?? "",
          row.option_a, row.option_b, row.option_c, row.option_d,
          ["A", "B", "C", "D"][row.correct_option] ?? "",
          row.explanation ?? "",
          row.course?.title_bn ?? row.course_id,
          row.subject?.title_bn ?? "",
          row.topic?.title_bn ?? "",
          row.subtopic?.title_bn ?? "",
          row.question_kind ?? "",
          row.source_type,
          row.exam_name ?? "",
          row.year ?? "",
          row.difficulty,
          row.status,
          row.is_verified ? "yes" : "no",
          row.created_at,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    if (rows.length < PAGE) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Bengali text opens correctly in Excel.
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jobhub-questions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
