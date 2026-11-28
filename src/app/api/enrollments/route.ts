import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["enroll", "pause", "resume", "set_default"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enrollment mutations as a plain form POST so server-rendered pages
 * (My Courses, dashboard course selector) can use them without client JS.
 *
 * - enroll       → upsert an active enrollment (RLS enforces published course)
 * - pause/resume → toggle enrollment status; history is never deleted
 * - set_default  → point profiles.target_course_id at an enrolled course
 *
 * Redirects back to `back` (must be an internal path) with ?enroll=<flag>.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const courseId = String(form.get("courseId") ?? "");
  const backRaw = String(form.get("back") ?? "/my-courses");
  const back = backRaw.startsWith("/") && !backRaw.startsWith("//") ? backRaw : "/my-courses";
  const redirectTo = (flag: string) => {
    const url = new URL(back, request.url);
    url.searchParams.set("enroll", flag);
    return NextResponse.redirect(url, 303);
  };

  if (!ACTIONS.has(action) || !UUID.test(courseId)) return redirectTo("error");

  const supabase = await getServerClient();
  if (!supabase) return redirectTo("error");

  if (action === "enroll") {
    const { error } = await supabase
      .from("student_course_enrollments")
      .upsert(
        { student_id: user.id, course_id: courseId, status: "active" },
        { onConflict: "student_id,course_id" },
      );
    if (error) return redirectTo("error");
    // First enrollment also becomes the default course if none is set yet.
    if (!user.profile?.target_course_id) {
      await supabase.from("profiles").update({ target_course_id: courseId }).eq("id", user.id);
    }
    return redirectTo("enrolled");
  }

  if (action === "pause" || action === "resume") {
    const { error } = await supabase
      .from("student_course_enrollments")
      .update({ status: action === "pause" ? "paused" : "active", updated_at: new Date().toISOString() })
      .eq("student_id", user.id)
      .eq("course_id", courseId);
    return redirectTo(error ? "error" : action === "pause" ? "paused" : "resumed");
  }

  // set_default — only onto a course the student is actively enrolled in.
  const { data: enrollment } = await supabase
    .from("student_course_enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) return redirectTo("error");

  const { error } = await supabase
    .from("profiles")
    .update({ target_course_id: courseId })
    .eq("id", user.id);
  return redirectTo(error ? "error" : "default");
}
