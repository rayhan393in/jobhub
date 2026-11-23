import type { Metadata } from "next";
import { Library, Link2, Link2Off, Share2 } from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminNote, AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";
import { formatNumber } from "@/lib/format";
import { CanonicalMapper } from "./canonical-mapper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "কেন্দ্রীয় বিষয় লাইব্রেরি" };

export type CanonicalSubject = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  is_active: boolean;
};

export type CourseSubject = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  canonical_subject_id: string | null;
  course_id: string;
  course_title: string;
};

/**
 * Central subject library ("store once, reuse everywhere").
 *
 * One canonical English / Mathematics / বাংলা record serves every course that
 * teaches it; each course keeps its OWN subject row (own ordering, marks,
 * weight) and only points at the shared identity. This page shows exactly
 * where each canonical subject is used, and lets an admin map or unmap a
 * course subject — nothing is ever merged automatically.
 */
export default async function CanonicalPage() {
  await requirePermission("taxonomy.manage");

  let canonical: CanonicalSubject[] = [];
  let subjects: CourseSubject[] = [];

  if (isSupabaseConfigured) {
    const supabase = getAdminClient();
    const [{ data: canonicalRows }, { data: subjectRows }, { data: courseRows }] = await Promise.all([
      supabase.from("canonical_subjects").select("id, slug, title_en, title_bn, is_active").order("slug"),
      supabase.from("subjects").select("id, slug, title_en, title_bn, canonical_subject_id, course_id"),
      supabase.from("courses").select("id, title_bn, slug").order("slug"),
    ]);
    const courseTitles = new Map(
      ((courseRows ?? []) as Array<{ id: string; title_bn: string | null; slug: string }>).map((course) => [
        course.id,
        course.title_bn ?? course.slug,
      ]),
    );
    canonical = (canonicalRows ?? []) as CanonicalSubject[];
    subjects = ((subjectRows ?? []) as Array<Omit<CourseSubject, "course_title">>)
      .map((subject) => ({ ...subject, course_title: courseTitles.get(subject.course_id) ?? "—" }))
      .sort((a, b) => a.course_title.localeCompare(b.course_title, "bn") || a.title_en.localeCompare(b.title_en));
  }

  const mapped = subjects.filter((subject) => subject.canonical_subject_id !== null).length;
  const sharedAcross = new Map<string, Set<string>>();
  for (const subject of subjects) {
    if (!subject.canonical_subject_id) continue;
    const set = sharedAcross.get(subject.canonical_subject_id) ?? new Set<string>();
    set.add(subject.course_id);
    sharedAcross.set(subject.canonical_subject_id, set);
  }
  const reusedCount = [...sharedAcross.values()].filter((set) => set.size >= 2).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="কেন্দ্রীয় ট্যাক্সোনমি"
        title="কেন্দ্রীয় বিষয় লাইব্রেরি"
        description="একটি বিষয় একবারই সংরক্ষিত — ইংরেজি, গণিত, বাংলা যেসব কোর্সে পড়ানো হয় সবগুলো একই ক্যানোনিকাল আইডি ব্যবহার করে। কোর্সভিত্তিক নাম, মার্কস ও গুরুত্ব স্বাধীন থাকে।"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniStat icon={<Library className="h-4 w-4" />} label="ক্যানোনিকাল বিষয়" value={formatNumber(canonical.length)} />
        <MiniStat icon={<Link2 className="h-4 w-4" />} label="ম্যাপকৃত কোর্স-বিষয়" value={formatNumber(mapped)} />
        <MiniStat icon={<Link2Off className="h-4 w-4" />} label="অম্যাপকৃত" value={formatNumber(subjects.length - mapped)} hint="ইচ্ছাকৃত আলাদা থাকতে পারে" />
        <MiniStat icon={<Share2 className="h-4 w-4" />} label="২+ কোর্সে পুনঃব্যবহৃত" value={formatNumber(reusedCount)} />
      </div>

      <AdminNote>
        নামের মিল থাকলেই ম্যাপ করা হয় না — অর্থ ভিন্ন হলে (যেমন ভর্তি পরীক্ষার Higher Math বনাম চাকরির Mathematics) বিষয় দুটি
        আলাদা থাকে। ম্যাপিং/আনম্যাপিং কোর্সের নিজস্ব সিলেবাসের কিছুই বদলায় না; প্রতিটি পরিবর্তন অডিট লগে যায়।
      </AdminNote>

      <CanonicalMapper canonical={canonical} subjects={subjects} />
    </div>
  );
}
