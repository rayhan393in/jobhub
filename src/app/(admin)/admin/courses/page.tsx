import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, GraduationCap, Layers, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { CourseManager } from "./course-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "কোর্স ও ট্যাক্সোনমি" };

export type AdminCourse = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  summary_bn: string | null;
  level: string;
  icon: string;
  accent: string;
  status: string;
  sort_order: number;
  subjects: {
    id: string;
    slug: string;
    title_bn: string;
    title_en: string;
    weight: number;
    sort_order: number;
    is_active: boolean;
    topics: {
      id: string;
      slug: string;
      title_bn: string;
      title_en: string;
      sort_order: number;
      is_active: boolean;
      subtopics: { id: string; slug: string; title_bn: string; sort_order: number; is_active: boolean }[];
    }[];
  }[];
};

export default async function CoursesAdminPage() {
  await requirePermission("taxonomy.manage");
  const supabase = await getServerClient();

  let courses: AdminCourse[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("courses")
      .select(
        "id, slug, title_en, title_bn, summary_bn, level, icon, accent, status, sort_order, subjects(id, slug, title_bn, title_en, weight, sort_order, is_active, topics(id, slug, title_bn, title_en, sort_order, is_active, subtopics(id, slug, title_bn, sort_order, is_active)))",
      )
      .order("sort_order")
      .order("sort_order", { referencedTable: "subjects" });
    courses = (data ?? []) as unknown as AdminCourse[];
  }

  const totals = courses.reduce(
    (acc, course) => {
      acc.courses += 1;
      acc.subjects += course.subjects.length;
      for (const subject of course.subjects) {
        acc.topics += subject.topics.length;
        for (const topic of subject.topics) acc.subtopics += topic.subtopics.length;
      }
      return acc;
    },
    { courses: 0, subjects: 0, topics: 0, subtopics: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="কোর্স ও ট্যাক্সোনমি"
        title="কোর্স, বিষয়, টপিক, সাবটপিক"
        description="নতুন কোর্স কোড পরিবর্তন ছাড়াই যোগ করা যায়। BCS-এর ১০ বিষয়সহ সব শ্রেণিবিন্যাস এখানেই সম্পাদনাযোগ্য।"
        action={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{formatNumber(totals.courses)} কোর্স</Badge>
            <Badge tone="neutral">{formatNumber(totals.topics)} টপিক</Badge>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: <GraduationCap className="size-3.5" />, label: "কোর্স", value: totals.courses },
          { icon: <BookOpen className="size-3.5" />, label: "বিষয়", value: totals.subjects },
          { icon: <Layers className="size-3.5" />, label: "টপিক", value: totals.topics },
          { icon: <Layers className="size-3.5" />, label: "সাবটপিক", value: totals.subtopics },
        ].map((item) => (
          <div key={item.label} className="jh-card flex items-center gap-2 p-3">
            <span className="text-[var(--brand)]">{item.icon}</span>
            <div>
              <p className="text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--text-subtle)]">{item.label}</p>
              <p className="text-[1rem] font-bold tabular-nums text-[var(--text)]">{formatNumber(item.value)}</p>
            </div>
          </div>
        ))}
      </div>

      <AdminNote>
        ড্রাফট কোর্স শিক্ষার্থীদের কাছে দেখা যায় না — প্রকাশ করার আগে অন্তত একটি বিষয় যোগ করুন। রুটিন বা পরীক্ষা
        তৈরি করলে সেগুলো আলাদাভাবে সংরক্ষিত থাকে; কোর্স প্রকাশ করা মানেই পরীক্ষা প্রকাশ নয়।
      </AdminNote>

      <div className="mt-4">
        {courses.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="কোনো কোর্স নেই"
            description="নতুন কোর্স তৈরি করে বিষয় ও টপিক যোগ করুন।"
          />
        ) : (
          <CourseManager courses={courses} />
        )}
      </div>

      <p className="mt-4 text-[0.625rem] text-[var(--text-subtle)]">
        কোর্সের পাবলিক পেজ:{" "}
        <Link href="/courses" className="font-semibold text-[var(--brand)] hover:underline">
          /courses
        </Link>{" "}
        · <Plus className="mb-0.5 inline size-3" aria-hidden /> নতুন কোর্স ওপরের বাটন থেকে।
      </p>
    </div>
  );
}
