import type { Metadata } from "next";
import { CalendarCheck2, Layers, ListChecks, ShieldAlert } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";
import { StudyRoutineHub, type CoverageRow, type ReadinessRow } from "./study-routine-hub";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "৬০ দিনের স্টাডি-রুটিন হাব" };

/**
 * /admin/study-routine — master-prompt Phase 3–4 hub.
 *
 * Everything on this page is computed live from the database:
 *  - Coverage Matrix (subjects / topics / subtopics vs first-study assignments)
 *  - exact unassigned-unit list (the publish blocker)
 *  - PYQ 70:30 readiness per subject
 *  - PYQ metadata backfill queue
 * No hardcoded totals: 10/137/366 appear only as TARGETS in the checklist,
 * and the checklist fails loudly whenever live counts differ.
 */
export default async function StudyRoutineHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ course?: string }>;
}) {
  await requirePermission("routine.manage");
  const supabase = await getServerClient();
  const courses = await listCourses();
  const requestedSlug = (await searchParams)?.course;
  const course =
    courses.find((c) => c.slug === requestedSlug) ??
    courses.find((c) => /বিসিএস|bcs/i.test(`${c.title_bn} ${c.title_en ?? ""}`)) ??
    courses[0];
  let courseMeta: { provisional?: boolean; pattern_note?: string; program_kind?: string } = {};
  if (supabase && course) {
    const { data: metaRow } = await supabase
      .from("courses")
      .select("metadata, program_kind")
      .eq("id", course.id)
      .maybeSingle();
    courseMeta = {
      ...((metaRow?.metadata ?? {}) as { provisional?: boolean; pattern_note?: string }),
      program_kind: (metaRow?.program_kind as string) ?? "course",
    };
  }

  type Availability = { pyq_total: number; pyq_ready: number; pyq_missing_meta: number; practice_pool: number };
  let coverage: CoverageRow[] = [];
  let readiness: ReadinessRow[] = [];
  let availability: Availability | null = null;
  let routineDays = 0;

  if (supabase && course) {
    const [coverageRes, readinessRes, availabilityRes, routineRes] = await Promise.all([
      supabase.rpc("jh_coverage_summary", { p_course_id: course.id }),
      supabase.rpc("jh_pyq_readiness_by_subject", { p_course_id: course.id }),
      supabase.rpc("jh_pyq_availability", { p_course_id: course.id }),
      supabase
        .from("routines")
        .select("routine_date", { count: "exact", head: false })
        .eq("course_id", course.id)
        .eq("kind", "daily")
        .eq("status", "published"),
    ]);
    coverage = (coverageRes.data ?? []) as CoverageRow[];
    readiness = (readinessRes.data ?? []) as ReadinessRow[];
    const avail = Array.isArray(availabilityRes.data) ? availabilityRes.data[0] : availabilityRes.data;
    availability = (avail ?? null) as Availability | null;
    routineDays = new Set(((routineRes.data ?? []) as { routine_date: string }[]).map((r) => r.routine_date)).size;
  }

  const totals = coverage.reduce(
    (acc, row) => ({
      units: acc.units + Number(row.units_total),
      assigned: acc.assigned + Number(row.units_assigned),
      unassigned: acc.unassigned + Number(row.units_unassigned),
      subtopics: acc.subtopics + Number(row.subtopics_total),
    }),
    { units: 0, assigned: 0, unassigned: 0, subtopics: 0 },
  );

  return (
    <div>
      <AdminPageHeader
        eyebrow="স্টাডি-প্রোগ্রাম মাস্টারপ্ল্যান"
        title="স্টাডি-রুটিন হাব — কভারেজ ম্যাপিং ও PYQ প্রস্তুতি"
        description="প্রতিটি সাবটপিকের individual first-study দিন, কভারেজ ম্যাট্রিক্স, PYQ-প্রস্তুতি ও মেটাডেটা ব্যাকফিল — সব সংখ্যা সরাসরি ডাটাবেস থেকে।"
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {courses.map((item) => (
          <a
            key={item.id}
            href={`/admin/study-routine?course=${item.slug}`}
            className={
              item.id === course?.id
                ? "rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[0.6875rem] font-semibold text-white"
                : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[0.6875rem] font-medium text-[var(--text-muted)] hover:border-[var(--brand)]/40"
            }
          >
            {item.title_bn}
          </a>
        ))}
      </div>

      {courseMeta.provisional ? (
        <div className="mb-4">
          <AdminNote tone="warning">
            <strong>প্রভিশনাল প্রোগ্রাম:</strong>{" "}
            {courseMeta.pattern_note ??
              "এই সিলেবাস-কাঠামো অফিসিয়াল নয় — যাচাইকৃত নিয়োগ বিজ্ঞপ্তি/সিলেবাস পাওয়া গেলে সেটিই প্রাধান্য পাবে।"}
          </AdminNote>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          icon={<Layers className="size-3.5" aria-hidden />}
          label="সিলেবাস ইউনিট"
          value={formatNumber(totals.units)}
          hint={`${formatNumber(totals.subtopics)} সাবটপিক + ${formatNumber(totals.units - totals.subtopics)} সাবটপিকবিহীন টপিক`}
        />
        <MiniStat
          icon={<ListChecks className="size-3.5" aria-hidden />}
          label="First-study বরাদ্দ"
          value={`${formatNumber(totals.assigned)}/${formatNumber(totals.units)}`}
          hint={totals.unassigned === 0 ? "সম্পূর্ণ কভারেজ" : `${formatNumber(totals.unassigned)}টি বাকি`}
        />
        <MiniStat
          icon={<CalendarCheck2 className="size-3.5" aria-hidden />}
          label="প্রকাশিত রুটিন-দিন"
          value={formatNumber(routineDays)}
          hint="published daily routine"
        />
        <MiniStat
          icon={<ShieldAlert className="size-3.5" aria-hidden />}
          label="PYQ প্রস্তুত (strict)"
          value={availability ? `${formatNumber(availability.pyq_ready)}/${formatNumber(availability.pyq_total)}` : "—"}
          hint={availability ? `${formatNumber(availability.pyq_missing_meta)}টির মেটাডেটা অসম্পূর্ণ` : "ডেটা নেই"}
        />
      </div>

      {availability && availability.pyq_ready < 70 ? (
        <div className="mb-4">
          <AdminNote tone="warning">
            দৈনিক ৭০:৩০ পরীক্ষা এখন ব্লকড: strict মোডে {formatNumber(70)}টি যাচাইকৃত PYQ দরকার, প্রস্তুত আছে{" "}
            {formatNumber(availability.pyq_ready)}টি। নিচের “PYQ মেটাডেটা” ট্যাবে exam_name/সাল/উৎস পূরণ করলেই সংখ্যা বাড়বে —
            কোনো অনুমান বা auto-fill হয় না।
          </AdminNote>
        </div>
      ) : null}

      {course ? (
        <StudyRoutineHub
          courseId={course.id}
          courseTitle={course.title_bn}
          initialCoverage={coverage}
          initialReadiness={readiness}
        />
      ) : (
        <AdminNote tone="warning">কোনো কোর্স পাওয়া যায়নি।</AdminNote>
      )}
    </div>
  );
}
