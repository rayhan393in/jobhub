import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Filter, GraduationCap, Layers,
  Search, ShieldCheck, BookOpenText, CircleHelp, X,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { getExamList, queryPyq } from "@/lib/question-bank";
import { QuestionCard } from "@/components/question-bank/question-card";
import { ExamPracticeButton } from "@/components/question-bank/practice-buttons";
import { listCourses, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "BCS Previous Year Questions · প্রশ্নব্যাংক" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const TYPES = new Set(["mcq", "written"]);
const SORTS = new Set(["year", "newest", "difficulty"]);
const PAGE_SIZE = 12;

function cleanText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export default async function BcsPreviousYearPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const courseParam = params.course && UUID.test(params.course) ? params.course : undefined;
  const examName = cleanText(params.exam, 160) ?? null;
  const yearNumber = Number(params.year);
  const examYear = Number.isInteger(yearNumber) && yearNumber >= 1971 && yearNumber <= 2100 ? yearNumber : null;
  const subjectId = params.subject && UUID.test(params.subject) ? params.subject : undefined;
  const topicId = params.topic && UUID.test(params.topic) ? params.topic : undefined;
  const subtopicId = params.subtopic && UUID.test(params.subtopic) ? params.subtopic : undefined;
  const difficulty = params.difficulty && DIFFICULTIES.has(params.difficulty) ? params.difficulty : undefined;
  const questionType = params.type && TYPES.has(params.type) ? params.type : undefined;
  const search = cleanText(params.q, 120) ?? null;
  const sort = params.sort && SORTS.has(params.sort) ? params.sort : "year";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const showAll = params.all === "1";
  const listMode = Boolean(examName) || showAll;

  const courses = await listCourses();
  const bcs = courses.find((course) => course.slug === "bcs");
  const courseId = bcs?.id ?? null;

  const [exams, subjects] = await Promise.all([
    getExamList("bcs"),
    courseId ? listSubjects(courseId) : Promise.resolve([]),
  ]);
  const allTopics = courseId && subjectId ? await listTopicsWithSubtopics(courseId) : [];
  const topics = allTopics.filter((topic) => topic.subject_id === subjectId);
  const activeTopic = topicId ? topics.find((topic) => topic.id === topicId) : undefined;

  const result = listMode
    ? await queryPyq({
        courseSlug: "bcs",
        examName: examName ?? null,
        examYear,
        subjectId: subjectId ?? null,
        topicId: topicId ?? null,
        subtopicId: subtopicId ?? null,
        questionType: questionType ?? null,
        difficulty: difficulty ?? null,
        search,
        sort,
        page,
        pageSize: PAGE_SIZE,
      })
    : null;

  const selectedExam = exams.find(
    (exam) => examName !== null && exam.exam_name.toLowerCase() === examName.toLowerCase() && (examYear === null || exam.year === examYear),
  );
  const labeledExams = exams.filter((exam) => exam.exam_name);
  const unlabeledBucket = exams.find((exam) => !exam.exam_name);
  const totalPyq = exams.reduce((acc, exam) => acc + exam.question_count, 0);
  const latestYear = exams.reduce<number | null>((acc, exam) => (exam.year !== null && (acc === null || exam.year > acc) ? exam.year : acc), null);

  const kept = new URLSearchParams();
  if (courseParam) kept.set("course", courseParam);
  if (examName) kept.set("exam", examName);
  if (examYear) kept.set("year", String(examYear));
  if (subjectId) kept.set("subject", subjectId);
  if (topicId) kept.set("topic", topicId);
  if (subtopicId) kept.set("subtopic", subtopicId);
  if (difficulty) kept.set("difficulty", difficulty);
  if (questionType) kept.set("type", questionType);
  if (search) kept.set("q", search);
  if (sort !== "year") kept.set("sort", sort);
  if (showAll) kept.set("all", "1");

  const pageHref = (target: number) => {
    const search2 = new URLSearchParams(kept);
    search2.set("page", String(target));
    return `/question-bank/bcs?${search2}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ------- header ------- */}
      <div className="mb-4">
        <Link
          href="/question-bank"
          className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[var(--text-subtle)] hover:text-[var(--brand)]"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          প্রশ্নব্যাংক
        </Link>
      </div>
      <PageHeader
        eyebrow="BCS Previous Year Questions"
        title="বিসিএস পূর্ববর্তী বছরের প্রশ্নব্যাংক"
        description="পরীক্ষাভিত্তিক ব্রাউজ করুন কিংবা বিষয়, টপিক ও সাবটপিক ধরে ফিল্টার করুন। শুধু অনুমোদিত ও যাচাইকৃত প্রশ্ন — AI-সহায়ক বা যাচাই-বিহীন কোনো প্রশ্ন এখানে নেই।"
      />

      {/* ------- stats strip (real counts) ------- */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCell icon={<BookOpenText className="size-4" />} label="মোট যাচাইকৃত PYQ" value={formatNumber(totalPyq)} />
        <StatCell icon={<CalendarClock className="size-4" />} label="প্রকাশিত পরীক্ষা" value={formatNumber(labeledExams.length)} />
        <StatCell icon={<GraduationCap className="size-4" />} label="সর্বশেষ বছর" value={latestYear ? formatNumber(latestYear) : "—"} />
      </div>

      {!listMode ? (
        /* ================= Exam selection (year-wise) ================= */
        <section aria-labelledby="exams-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="exams-h" className="text-[1.0625rem] font-bold tracking-[-0.02em] text-[var(--text)]">
              পরীক্ষা বেছে নিন
            </h2>
            {exams.length > 0 ? (
              <Link href="/question-bank/bcs?all=1" className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--brand)] hover:underline">
                সবগুলো একসাথে দেখুন
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>

          {exams.length === 0 ? (
            <EmptyState
              icon={<BookOpenText className="size-5" />}
              title="এখনো কোনো BCS পূর্ববর্তী বছরের প্রশ্ন যাচাই হয়ে প্রকাশিত হয়নি"
              description="প্রশ্ন ইমপোর্ট ও যাচাই-পর্যালোচনা শেষে এখানে পরীক্ষাভিত্তিক তালিকা দেখা যাবে। প্রশাসক প্রশ্নব্যাংক ইমপোর্ট ও অনুমোদন করলে সংখ্যাগুলো নিজে থেকেই আপডেট হবে।"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {labeledExams.map((exam) => (
                <Link
                  key={`${exam.exam_name}-${exam.year ?? "na"}`}
                  href={`/question-bank/bcs?exam=${encodeURIComponent(exam.exam_name ?? "")}${exam.year !== null ? `&year=${exam.year}` : ""}`}
                  className="jh-card jh-card-hover group flex flex-col p-5 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Layers className="size-5" aria-hidden />
                    </span>
                    {exam.year ? <Badge tone="brand">{formatNumber(exam.year)}</Badge> : <Badge tone="neutral">বছর নেই</Badge>}
                  </div>
                  <h3 className="mt-3 font-bangla text-[0.9375rem] font-bold leading-snug text-[var(--text)] group-hover:text-[var(--brand)]">
                    {exam.exam_name}
                  </h3>
                  <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">
                    {formatNumber(exam.question_count)}টি যাচাইকৃত প্রশ্ন · {formatNumber(exam.subject_count)}টি বিষয়
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--brand)]">
                    প্রশ্ন দেখুন
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              ))}
              {unlabeledBucket ? (
                <Link
                  href="/question-bank/bcs?all=1"
                  className="jh-card jh-card-hover group flex flex-col border-dashed p-5 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                      <CircleHelp className="size-5" aria-hidden />
                    </span>
                    <Badge tone="warning">অচিহ্নিত</Badge>
                  </div>
                  <h3 className="mt-3 font-bangla text-[0.9375rem] font-bold leading-snug text-[var(--text)] group-hover:text-[var(--brand)]">
                    অচিহ্নিত পূর্ববর্তী বছরের প্রশ্ন
                  </h3>
                  <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
                    যাচাইকৃত, কিন্তু মূল পরীক্ষা ও বছর নথিভুক্ত নেই — প্রশাসকের কিউরেশনের অপেক্ষমান।
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">
                    {formatNumber(unlabeledBucket.question_count)}টি যাচাইকৃত প্রশ্ন
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--brand)]">
                    প্রশ্ন দেখুন
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              ) : null}
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
            <p>
              প্রতিটি প্রশ্ন প্রকাশের আগে প্রশাসক যাচাই করেন। মূল পরীক্ষা ও বছর ডেটাবেসে সংরক্ষিত; ভুল উৎস বা অনুমানকৃত কোনো তথ্য দেখানো হয় না। প্রশ্নের উত্তর ও ব্যাখ্যা অনুশীলনের পরে — কখনো আগে নয়।
            </p>
          </div>
        </section>
      ) : (
        /* ================= Filtered question list ================= */
        <section aria-labelledby="list-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link href="/question-bank/bcs" className="text-[0.75rem] font-semibold text-[var(--text-subtle)] hover:text-[var(--brand)]">
                ← সব পরীক্ষা
              </Link>
              <h2 id="list-h" className="font-bangla text-[1.0625rem] font-bold tracking-[-0.01em] text-[var(--text)]">
                {examName ? `${examName}${examYear ? ` · ${formatNumber(examYear)}` : ""}` : "সব BCS পূর্ববর্তী প্রশ্ন"}
              </h2>
            </div>
            <span className="text-[0.75rem] font-semibold text-[var(--text-muted)]">
              {result ? formatNumber(result.total) : "০"}টি প্রশ্ন
            </span>
          </div>

          {result && examName && courseId ? (
            <div className="mb-4">
              <ExamPracticeButton
                courseId={courseId}
                examName={examName}
                examYear={examYear}
                total={selectedExam?.question_count ?? result.total}
              />
            </div>
          ) : null}

          {/* ------- filter bar (GET form, real DB queries) ------- */}
          <form method="get" className="jh-card mb-4 flex flex-wrap items-end gap-2 p-3">
            {examName ? (
              <>
                <input type="hidden" name="exam" value={examName} />
                {examYear ? <input type="hidden" name="year" value={examYear} /> : null}
              </>
            ) : (
              <input type="hidden" name="all" value="1" />
            )}
            <div className="min-w-0 flex-1 sm:min-w-[12rem]">
              <label htmlFor="q" className="jh-label">খুঁজুন</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
                <Input id="q" name="q" defaultValue={search ?? undefined} placeholder="প্রশ্নের শব্দ…" className="h-9 pl-8 text-[0.75rem]" />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="jh-label">বিষয়</label>
              <select id="subject" name="subject" defaultValue={subjectId ?? ""} className="jh-select h-9 max-w-[12rem] text-[0.75rem]">
                <option value="">সব বিষয়</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                ))}
              </select>
            </div>
            {subjectId && topics.length > 0 ? (
              <div>
                <label htmlFor="topic" className="jh-label">টপিক</label>
                <select id="topic" name="topic" defaultValue={topicId ?? ""} className="jh-select h-9 max-w-[12rem] text-[0.75rem]">
                  <option value="">সব টপিক</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.title_bn}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {activeTopic && activeTopic.subtopics.length > 0 ? (
              <div>
                <label htmlFor="subtopic" className="jh-label">সাবটপিক</label>
                <select id="subtopic" name="subtopic" defaultValue={subtopicId ?? ""} className="jh-select h-9 max-w-[12rem] text-[0.75rem]">
                  <option value="">সব সাবটপিক</option>
                  {activeTopic.subtopics.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.title_bn}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="difficulty" className="jh-label">কঠিনতা</label>
              <select id="difficulty" name="difficulty" defaultValue={difficulty ?? ""} className="jh-select h-9 text-[0.75rem]">
                <option value="">সব</option>
                <option value="easy">সহজ</option>
                <option value="medium">মধ্যম</option>
                <option value="hard">কঠিন</option>
              </select>
            </div>
            <div>
              <label htmlFor="type" className="jh-label">ধরন</label>
              <select id="type" name="type" defaultValue={questionType ?? ""} className="jh-select h-9 text-[0.75rem]">
                <option value="">সব</option>
                <option value="mcq">MCQ</option>
                <option value="written">লিখিত</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort" className="jh-label">সাজান</label>
              <select id="sort" name="sort" defaultValue={sort} className="jh-select h-9 text-[0.75rem]">
                <option value="year">বছর (নতুন → পুরনো)</option>
                <option value="newest">ইমপোর্ট নতুন</option>
                <option value="difficulty">কঠিনতা</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-[0.75rem] font-semibold text-white"
            >
              <Filter className="size-3.5" aria-hidden />
              ফিল্টার
            </button>
            {kept.toString() ? (
              <Link
                href={examName ? "/question-bank/bcs" : "/question-bank/bcs?all=1"}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[0.6875rem] font-semibold text-[var(--text-subtle)] hover:text-[var(--danger)]"
              >
                <X className="size-3.5" aria-hidden />
                ক্লিয়ার
              </Link>
            ) : null}
          </form>

          {/* ------- rows ------- */}
          {result && result.rows.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি"
              description="ফিল্টার বা সার্চ পরিবর্তন করুন, অথবা সব ফিল্টার মুছে আবার চেষ্টা করুন।"
            />
          ) : result ? (
            <ol className="space-y-3">
              {result.rows.map((row, index) => (
                <QuestionCard key={row.id} question={row} number={(result.page - 1) * PAGE_SIZE + index + 1} />
              ))}
            </ol>
          ) : null}

          {/* ------- pagination ------- */}
          {result && result.total_pages > 1 ? (
            <nav className="mt-4 flex items-center justify-between gap-2" aria-label="পেজ নাম্বার">
              <span className="text-[0.75rem] font-medium text-[var(--text-subtle)]">
                পৃষ্ঠা {formatNumber(result.page)} / {formatNumber(result.total_pages)}
              </span>
              <div className="flex items-center gap-2">
                {result.page > 1 ? (
                  <Link
                    href={pageHref(result.page - 1)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-strong)] px-3 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:text-[var(--brand)]"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    আগের
                  </Link>
                ) : null}
                {result.page < result.total_pages ? (
                  <Link
                    href={pageHref(result.page + 1)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-strong)] px-3 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:text-[var(--brand)]"
                  >
                    পরের
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
        {icon}
      </span>
      <p className="mt-2 text-[1.25rem] font-extrabold leading-none tracking-[-0.03em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-[0.625rem] font-medium text-[var(--text-subtle)]">{label}</p>
    </div>
  );
}
