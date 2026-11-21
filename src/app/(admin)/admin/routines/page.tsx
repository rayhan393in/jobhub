import type { Metadata } from "next";
import { CalendarDays, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getServerClient } from "@/lib/supabase/server";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { dhakaDateKey, formatDate, formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { RoutineManager } from "./routine-manager";
import { RoutineCsvImport } from "@/components/admin/routine-csv-import";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "রুটিন ম্যানেজার" };

export type AdminRoutine = {
  id: string;
  course_id: string;
  kind: string;
  routine_date: string;
  title_bn: string;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  minutes: number;
  focus_note_bn: string | null;
  status: string;
  subject_title_bn?: string | null;
  topic_title_bn?: string | null;
};

export default async function RoutinesAdminPage() {
  await requirePermission("routine.manage");
  const today = dhakaDateKey();
  const supabase = await getServerClient();
  const courses = await listCourses();

  let routines: AdminRoutine[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("routines")
      .select(
        "id, course_id, kind, routine_date, title_bn, subject_id, topic_id, subtopic_id, minutes, focus_note_bn, status, subject_title_bn:subjects(title_bn), topic_title_bn:topics(title_bn)",
      )
      .gte("routine_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .order("routine_date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(120);
    routines = (data ?? []) as unknown as AdminRoutine[];
  }

  const drafts = routines.filter((r) => r.status === "draft").length;
  const published = routines.filter((r) => r.status === "published").length;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="রুটিন ম্যানেজার"
        title="দৈনিক পড়ার রুটিন"
        description="রুটিন তৈরি করে প্রকাশ করুন। রুটিন প্রকাশ করা কোনো পরীক্ষা প্রকাশ করে না — দুটি সম্পূর্ণ আলাদা কাজ।"
        action={
          <div className="flex gap-1.5">
            <Badge tone="warning">{formatNumber(drafts)} ড্রাফট</Badge>
            <Badge tone="success">{formatNumber(published)} প্রকাশিত</Badge>
          </div>
        }
      />

      <AdminNote tone="warning">
        <strong>রুটিন সংরক্ষণ ≠ পরীক্ষা প্রকাশ।</strong> রুটিন ড্রাফট হিসেবে থাকলে শিক্ষার্থীরা দেখতে পায় না;
        প্রকাশ করলে শুধু পড়ার পরিকল্পনা দেখা যায়। লাইভ পরীক্ষা শুধু “পরীক্ষা প্রকাশ” মডিউল থেকে যায়।
      </AdminNote>

      <div className="mt-4">
        <RoutineCsvImport
          courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))}
          today={today}
        />
      </div>

      <div className="mt-4">
        <RoutineManager
          routines={routines}
          courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))}
          today={today}
        />
      </div>

      <div className="mt-4 flex items-start gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        <p>
          আজ ({formatDate(`${today}T12:00:00`)}) · শুধু গত ৭ দিন ও ভবিষ্যতের রুটিন দেখানো হচ্ছে। পুরোনো রুটিন
          স্বয়ংক্রিয়ভাবে আর্কাইভ হয়ে থাকে।
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          { icon: <CalendarDays className="size-3.5" />, label: "মোট (৭ দিন+)", value: routines.length },
          { icon: <CalendarDays className="size-3.5" />, label: "আজকের রুটিন", value: routines.filter((r) => r.routine_date === today).length },
          { icon: <CalendarDays className="size-3.5" />, label: "সাপ্তাহিক স্পেশাল", value: routines.filter((r) => r.kind === "weekly_special").length },
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
    </div>
  );
}
