import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import { getCourseBySlug } from "@/lib/queries";
import { getCourseSyllabus, type MarksRow } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ course: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { course } = await params;
  const found = await getCourseBySlug(course);
  if (!found) return { title: "সিলেবাস পাওয়া যায়নি" };
  return {
    title: `${found.title_bn} — সিলেবাস ও নম্বর বিভাজন`,
    description: `${found.title_bn} পরীক্ষার বিষয়ভিত্তিক সিলেবাস, সাব-টপিকের অগ্রাধিকার ও নম্বর বিভাজন।`,
  };
}

const PRIORITY_LABEL: Record<string, string> = { P1: "P1", P2: "P2", P3: "P3" };
const PRIORITY_TONE: Record<string, "brand" | "info" | "neutral"> = {
  P1: "brand",
  P2: "info",
  P3: "neutral",
};

const STAGE_ORDER: MarksRow["stage"][] = ["preliminary", "written", "viva", "total"];
const STAGE_LABEL: Record<MarksRow["stage"], string> = {
  preliminary: "প্রিলিমিনারি / প্রাথমিক",
  written: "লিখিত",
  viva: "মৌখিক",
  total: "মোট",
};

function marksNumber(value: number | null, suffix = "") {
  if (value === null) return "—";
  return `${formatNumber(value)}${suffix}`;
}

export default async function CourseSyllabusPage({ params }: Params) {
  const { course } = await params;
  const courseRow = await getCourseBySlug(course);
  if (!courseRow) notFound();

  const syllabus = await getCourseSyllabus(course);
  if (!syllabus) notFound();

  const marksByStage = STAGE_ORDER.map((stage) => ({
    stage,
    rows: syllabus.marks.filter((row) => row.stage === stage),
  })).filter((group) => group.rows.length > 0);

  return (
    <div>
      <section className="jh-hero-field border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-[0.75rem] text-[var(--text-subtle)]">
            <Link href="/syllabus" className="hover:text-[var(--brand)]">
              সিলেবাস
            </Link>
            <span aria-hidden> / </span>
            <span className="text-[var(--text-muted)]">{courseRow.title_bn}</span>
          </nav>

          <h1 className="mt-4 text-balance text-[1.875rem] font-bold leading-tight tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
            {courseRow.title_bn}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            সম্পূর্ণ সিলেবাস — বিষয় → টপিক → সাব-টপিক, প্রতিটির অগ্রাধিকারসহ। নিচে আলাদা অংশে
            পরীক্ষার নম্বর বিভাজন।
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="brand">{formatNumber(syllabus.subjects.length)} বিষয়</Badge>
            <Badge tone="neutral">{formatNumber(syllabus.totals.topics)} টপিক</Badge>
            <Badge tone="neutral">{formatNumber(syllabus.totals.subtopics)} সাব-টপিক</Badge>
            {syllabus.totals.marks > 0 ? (
              <Badge tone="success">মোট {formatNumber(syllabus.totals.marks)} নম্বর</Badge>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Marks distribution ─────────────────────────────────────────── */}
        <section aria-labelledby="marks-heading">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="marks-heading" className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--text)]">
              নম্বর বিভাজন
            </h2>
            {syllabus.totals.marks > 0 ? (
              <p className="text-[0.8125rem] text-[var(--text-muted)]">
                বিষয়ভিত্তিক মোট: <strong className="text-[var(--text)]">{formatNumber(syllabus.totals.marks)}</strong> নম্বর
              </p>
            ) : null}
          </header>

          {marksByStage.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              এই কোর্সের নম্বর বিভাজন এখনো যাচাই করে যোগ করা হয়নি — অনুমান করা সংখ্যা দেখানো হয় না।
              নিশ্চিত তথ্যের জন্য সংশ্লিষ্ট কমিশনের সর্বশেষ বিজ্ঞপ্তি দেখুন।
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {marksByStage.map((group) => (
                <div key={group.stage} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
                    <h3 className="text-[0.875rem] font-semibold text-[var(--text)]">{STAGE_LABEL[group.stage]}</h3>
                    <span className="text-[0.6875rem] text-[var(--text-subtle)]">
                      {group.rows.length} {group.stage === "total" ? "সারাংশ" : "পত্র"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] border-collapse text-[0.8125rem]">
                      <thead>
                        <tr className="text-left text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                          <th scope="col" className="px-4 py-2 font-semibold">পত্র / অংশ</th>
                          <th scope="col" className="px-3 py-2 font-semibold">প্রশ্ন</th>
                          <th scope="col" className="px-3 py-2 font-semibold">নম্বর/প্রশ্ন</th>
                          <th scope="col" className="px-3 py-2 font-semibold">নেগেটিভ</th>
                          <th scope="col" className="px-3 py-2 font-semibold">সময়</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold">মোট</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id} className="border-t border-[var(--border)] align-top">
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-[var(--text)]">{row.paper_bn || row.stage_bn}</span>
                              {row.note_bn ? (
                                <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
                                  {row.note_bn}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-[var(--text-muted)]">{marksNumber(row.question_count)}</td>
                            <td className="px-3 py-2.5 text-[var(--text-muted)]">{marksNumber(row.marks_per_question)}</td>
                            <td className="px-3 py-2.5 text-[var(--text-muted)]">
                              {row.negative_marks > 0 ? `−${formatNumber(row.negative_marks)}` : "নেই"}
                            </td>
                            <td className="px-3 py-2.5 text-[var(--text-muted)]">
                              {row.duration_minutes ? `${formatNumber(row.duration_minutes)} মিনিট` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-[var(--text)]">
                              {formatNumber(row.total_marks)}
                              {row.pass_marks ? (
                                <span className="mt-0.5 block text-[0.625rem] font-normal text-[var(--text-subtle)]">
                                  পাস {formatNumber(row.pass_marks)}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Outline ────────────────────────────────────────────────────── */}
        <section aria-labelledby="outline-heading" className="mt-12">
          <h2 id="outline-heading" className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--text)]">
            বিষয় ও টপিক রূপরেখা
          </h2>
          <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
            <span>
              অগ্রাধিকার নির্দেশ করে কোন সাব-টপিক থেকে প্রশ্ন আসার সম্ভাবনা সবচেয়ে বেশি (P1) — এটি
              প্রস্তুতির ক্রম ঠিক করার জন্য, কোনো নিশ্চিত প্রতিশ্রুতি নয়। সংশ্লিষ্ট কমিশনের সর্বশেষ
              বিজ্ঞপ্তি সবসময় প্রাধান্য পাবে।
            </span>
          </p>

          {syllabus.subjects.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={<Layers className="size-5" />}
                title="এই কোর্সে এখনো বিষয় যোগ করা হয়নি"
                description="প্রশাসক বিষয় ও টপিক যোগ করলে এখানে দেখা যাবে।"
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {syllabus.subjects.map((subject) => (
                <details
                  key={subject.id}
                  className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                  open={syllabus.subjects.length <= 4}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--surface-muted)]">
                    <span className="min-w-0">
                      <span className="block text-[0.9375rem] font-semibold text-[var(--text)]">
                        {subject.title_bn}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] text-[var(--text-subtle)]">
                        {formatNumber(subject.topics.length)} টপিক · {formatNumber(subject.subtopic_count)} সাব-টপিক
                        {subject.weight > 0 ? ` · ${formatNumber(subject.weight)} নম্বর` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {subject.priority_counts.P1 > 0 ? (
                        <Badge tone="brand">P1 {formatNumber(subject.priority_counts.P1)}</Badge>
                      ) : null}
                      {subject.priority_counts.P2 > 0 ? (
                        <Badge tone="info">P2 {formatNumber(subject.priority_counts.P2)}</Badge>
                      ) : null}
                    </span>
                  </summary>

                  <div className="border-t border-[var(--border)] px-5 py-3.5">
                    {subject.topics.length === 0 ? (
                      <p className="text-[0.8125rem] text-[var(--text-subtle)]">এই বিষয়ে এখনো টপিক নেই।</p>
                    ) : (
                      <ol className="space-y-4">
                        {subject.topics.map((topic) => (
                          <li key={topic.id}>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="text-[0.8125rem] font-semibold text-[var(--text)]">
                                {topic.title_bn}
                              </span>
                              {topic.priority_mix ? (
                                <span className="text-[0.6875rem] text-[var(--text-subtle)]">{topic.priority_mix}</span>
                              ) : null}
                            </div>
                            {topic.subtopics.length > 0 ? (
                              <ul className="mt-1.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
                                {topic.subtopics.map((subtopic) => (
                                  <li
                                    key={subtopic.id}
                                    className="flex items-start justify-between gap-2 border-b border-dashed border-[var(--border)] pb-1 text-[0.8125rem] text-[var(--text-muted)]"
                                  >
                                    <span>{subtopic.title_bn}</span>
                                    {subtopic.priority ? (
                                      <Badge tone={PRIORITY_TONE[subtopic.priority]}>
                                        {PRIORITY_LABEL[subtopic.priority]}
                                      </Badge>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-[0.75rem] text-[var(--text-subtle)]">সাব-টপিক নেই — পুরো টপিকটিই একটি ইউনিট।</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
