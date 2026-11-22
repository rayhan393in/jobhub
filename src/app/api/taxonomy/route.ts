import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listSubjects, listTopicsWithSubtopics } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Taxonomy lookup used by the admin editors and the exam builder. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const subjectId = url.searchParams.get("subjectId");

  if (courseId) {
    if (!UUID.test(courseId)) {
      return NextResponse.json({ error: "অবৈধ কোর্স আইডি।" }, { status: 400 });
    }
    const [subjects, topics] = await Promise.all([
      listSubjects(courseId),
      listTopicsWithSubtopics(courseId),
    ]);
    return NextResponse.json(
      {
        subjects: subjects.map((s) => ({ id: s.id, title_bn: s.title_bn, title_en: s.title_en })),
        topics: topics.map((t) => ({
          id: t.id,
          subject_id: t.subject_id,
          title_bn: t.title_bn,
          subtopics: t.subtopics.map((sub) => ({ id: sub.id, title_bn: sub.title_bn })),
        })),
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  if (subjectId) {
    if (!UUID.test(subjectId)) {
      return NextResponse.json({ error: "অবৈধ বিষয় আইডি।" }, { status: 400 });
    }
    const supabase = await (await import("@/lib/supabase/server")).getServerClient();
    if (!supabase) return NextResponse.json({ topics: [] });
    const { data } = await supabase
      .from("topics")
      .select("id, title_bn, title_en")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .order("sort_order");
    return NextResponse.json({ topics: data ?? [] }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  return NextResponse.json({ error: "courseId বা subjectId প্রয়োজন।" }, { status: 400 });
}
