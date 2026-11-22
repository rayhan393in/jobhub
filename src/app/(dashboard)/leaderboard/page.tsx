import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard, listCourses, listPublishedSchedules, releaseDueResults } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "লিডারবোর্ড" };

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Persist release flags for any schedule whose publication time has passed.
  await releaseDueResults();
  const [courses, schedules] = await Promise.all([listCourses(), listPublishedSchedules({ limit: 40 })]);
  const initialRows = await getLeaderboard({ scope: "daily", limit: 50 });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="লিডারবোর্ড"
        title="সেরা প্রস্তুতি — যাচাইযোগ্য ফলাফল"
        description="প্রতিটি অবস্থান প্রকাশিত ফলাফল থেকে তৈরি হয়। তালিকায় কোনো নমুনা বা কৃত্রিম নাম নেই।"
      />
      <LeaderboardClient
        initialRows={initialRows}
        courses={courses.map((c) => ({ id: c.id, slug: c.slug, title_bn: c.title_bn }))}
        exams={schedules.map((s) => ({ id: s.id, title_bn: s.title_bn }))}
        currentUserId={user.id}
      />
    </div>
  );
}
