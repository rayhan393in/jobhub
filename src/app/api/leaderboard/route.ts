import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard, getMyRank, releaseDueResults } from "@/lib/queries";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  }

  const url = new URL(request.url);
  const scopeRaw = url.searchParams.get("scope") ?? "daily";
  if (!["daily", "weekly", "course", "exam"].includes(scopeRaw)) {
    return NextResponse.json({ error: "অবৈধ লিডারবোর্ড স্কোপ।" }, { status: 400 });
  }
  const courseId = url.searchParams.get("courseId");
  const scheduleId = url.searchParams.get("scheduleId");
  if (courseId && !UUID.test(courseId)) {
    return NextResponse.json({ error: "অবৈধ কোর্স আইডি।" }, { status: 400 });
  }
  if (scheduleId && !UUID.test(scheduleId)) {
    return NextResponse.json({ error: "অবৈধ পরীক্ষা আইডি।" }, { status: 400 });
  }
  if (scopeRaw === "course" && !courseId) {
    return NextResponse.json({ error: "কোর্স নির্বাচন করুন।" }, { status: 400 });
  }
  if (scopeRaw === "exam" && !scheduleId) {
    return NextResponse.json({ error: "পরীক্ষা নির্বাচন করুন।" }, { status: 400 });
  }

  try {
    // Flip any result whose publication time has passed (idempotent).
    await releaseDueResults();
    const scope = scopeRaw as "daily" | "weekly" | "course" | "exam";
    const [rows, myRank] = await Promise.all([
      getLeaderboard({ scope, courseId, scheduleId, limit: 50 }),
      // The caller's true rank even when they are below the top-50 window.
      getMyRank({ scope, courseId, scheduleId }),
    ]);
    return NextResponse.json({ rows, myRank }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fromDbError(error);
  }
}
