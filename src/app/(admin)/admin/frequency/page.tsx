import type { Metadata } from "next";
import { BarChart3, Info } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { FrequencyManager } from "./frequency-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্রশ্ন-ফ্রিকোয়েন্সি" };

export type FrequencyRow = {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  exam_name: string;
  exam_year: number | null;
  question_count: number;
  source_title: string;
};

export type RankedTopic = {
  topic_id: string | null;
  subject_id: string | null;
  subject_bn: string | null;
  topic_bn: string | null;
  total_questions: number;
  paper_count: number;
  last_year: number | null;
  band: string;
};

export default async function FrequencyPage() {
  await requirePermission("question.import");
  const courses = await listCourses();
  const supabase = await getServerClient();

  let rows: FrequencyRow[] = [];
  let ranked: RankedTopic[] = [];
  let totalPapers = 0;

  if (supabase) {
    const { data } = await supabase
      .from("question_frequency")
      .select("id, subject_id, topic_id, exam_name, exam_year, question_count, source_title")
      .order("exam_year", { ascending: false })
      .order("exam_name")
      .limit(300);
    rows = (data ?? []) as FrequencyRow[];
    totalPapers = new Set(rows.map((row) => `${row.exam_name}:${row.exam_year ?? ""}`)).size;

    if (courses[0]) {
      const { data: ranking } = await supabase.rpc("jh_topic_frequency", { p_course_id: courses[0].id });
      ranked = (ranking ?? []) as RankedTopic[];
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="প্রশ্ন-ফ্রিকোয়েন্সি"
        title="বিগত বছরের প্রশ্ন-বিশ্লেষণ"
        description="কোন টপিক থেকে কতটি প্রশ্ন এসেছে — গণনা করা হয় বাস্তব প্রশ্নপত্র থেকে। এই সংখ্যাই ঠিক করে কোন টপিক আগে পড়া হবে।"
        action={<BarChart3 className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote tone="brand">
        <Info className="mr-1 inline size-3.5" aria-hidden />
        <strong>এটি অনুমান নয়।</strong> প্রতিটি সারি একটি নির্দিষ্ট পরীক্ষা ও উৎসের নাম বহন করে। যে টপিকের কোনো সারি নেই,
        তাকে “কম আসে” বলা হয় না — <em>“তথ্য নেই”</em> দেখানো হয়। সারি না থাকলে সাপ্তাহিক রুটিনও সিলেবাসের ক্রমে চলে।
      </AdminNote>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          { label: "মোট সারি", value: rows.length },
          { label: "পরীক্ষা", value: totalPapers },
          { label: "টপিক বিশ্লেষিত", value: ranked.length },
          {
            label: "সর্বোচ্চ প্রশ্ন",
            value: ranked.reduce((max, row) => Math.max(max, Number(row.total_questions) || 0), 0),
          },
        ].map((stat) => (
          <div key={stat.label} className="jh-card px-3 py-2.5">
            <p className="text-[0.5625rem] uppercase tracking-wide text-[var(--text-subtle)]">{stat.label}</p>
            <p className="mt-0.5 text-[1.125rem] font-bold tabular-nums text-[var(--text)]">
              {formatNumber(Number(stat.value) || 0)}
            </p>
          </div>
        ))}
      </div>

      {ranked.length > 0 ? (
        <section className="mt-4" aria-labelledby="priority-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="priority-heading" className="text-[0.875rem] font-bold text-[var(--text)]">
              স্টাডি প্রায়োরিটি — সবচেয়ে বেশি প্রশ্ন আসা টপিক
            </h2>
            <div className="flex gap-1">
              <Badge tone="danger">হাই</Badge>
              <Badge tone="warning">মিড</Badge>
              <Badge tone="neutral">লো</Badge>
            </div>
          </div>
          <div className="jh-card overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {ranked.slice(0, 20).map((row, index) => (
                <li key={`${row.topic_id}-${index}`} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 shrink-0 text-[0.625rem] font-bold tabular-nums text-[var(--text-subtle)]">
                    {formatNumber(index + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">{row.topic_bn ?? "—"}</p>
                    <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">{row.subject_bn ?? ""}</p>
                  </div>
                  <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[var(--text)]">
                    {formatNumber(Number(row.total_questions) || 0)} প্রশ্ন
                  </span>
                  <span className="w-14 shrink-0 text-right text-[0.5625rem] text-[var(--text-subtle)]">
                    {formatNumber(Number(row.paper_count) || 0)} পরীক্ষা
                  </span>
                  <Badge tone={row.band === "high" ? "danger" : row.band === "medium" ? "warning" : "neutral"}>
                    {row.band === "high" ? "হাই" : row.band === "medium" ? "মিড" : "লো"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-1.5 text-[0.5625rem] leading-relaxed text-[var(--text-subtle)]">
            ব্যান্ড = আপনার লোড করা তথ্যে এই টপিকগুলোর tertile ভাগ। এটি ভবিষ্যতে প্রশ্ন আসার সম্ভাবনা নয় — শুধু এখন পর্যন্ত
            গণনা করা প্রশ্নের তুলনা।
          </p>
        </section>
      ) : null}

      <div className="mt-4">
        <FrequencyManager
          courses={courses.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
          initialCourseId={courses[0]?.id ?? ""}
          rows={rows}
        />
      </div>
    </div>
  );
}
