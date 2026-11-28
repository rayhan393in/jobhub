import "server-only";
import { getServerClient } from "./supabase/server";

/**
 * The public syllabus (সিলেবাস) reader.
 *
 * One subject → topic → subtopic outline per course, plus the marks
 * distribution (`exam_marks`) and the per-subject marks weight. Everything goes
 * through RLS as the visitor — the public policies already restrict these tables
 * to published courses, so this file holds no secrets and needs no RPC. (Per
 * subtopic question counts are deliberately absent: `questions` has no public
 * select policy and the anon function surface is audited down to two calls.)
 */

export type SyllabusSubtopic = {
  id: string;
  slug: string;
  title_bn: string;
  title_en: string;
  priority: "P1" | "P2" | "P3" | null;
};

export type SyllabusTopic = {
  id: string;
  slug: string;
  title_bn: string;
  title_en: string;
  priority: string | null;
  priority_mix: string | null;
  subtopics: SyllabusSubtopic[];
};

export type SyllabusSubject = {
  id: string;
  slug: string;
  title_bn: string;
  title_en: string;
  weight: number;
  topics: SyllabusTopic[];
  subtopic_count: number;
  priority_counts: { P1: number; P2: number; P3: number };
};

export type MarksRow = {
  id: string;
  stage: "preliminary" | "written" | "viva" | "total";
  stage_bn: string;
  paper_bn: string;
  question_count: number | null;
  marks_per_question: number | null;
  negative_marks: number;
  duration_minutes: number | null;
  total_marks: number;
  pass_marks: number | null;
  note_bn: string;
};

export type Syllabus = {
  subjects: SyllabusSubject[];
  marks: MarksRow[];
  totals: { marks: number; topics: number; subtopics: number };
};

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function priorityOf(metadata: unknown): "P1" | "P2" | "P3" | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).priority;
  return raw === "P1" || raw === "P2" || raw === "P3" ? raw : null;
}

/** The full published syllabus of one course, or null when the course is not published. */
export async function getCourseSyllabus(courseSlug: string): Promise<(Syllabus & { courseId: string }) | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title_bn, status")
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!course) return null;

  const [{ data: subjectRows }, { data: markRows }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, slug, title_en, title_bn, weight, sort_order")
      .eq("course_id", course.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("exam_marks")
      .select(
        "id, stage, stage_bn, paper_bn, question_count, marks_per_question, negative_marks, duration_minutes, total_marks, pass_marks, note_bn, sort_order",
      )
      .eq("course_id", course.id)
      .order("sort_order"),
  ]);

  const subjects = subjectRows ?? [];
  const subjectIds = subjects.map((s) => s.id);

  let topicRows: Array<{
    id: string; subject_id: string; slug: string; title_en: string; title_bn: string; metadata: unknown; sort_order: number;
  }> = [];
  if (subjectIds.length > 0) {
    const { data } = await supabase
      .from("topics")
      .select("id, subject_id, slug, title_en, title_bn, metadata, sort_order")
      .in("subject_id", subjectIds)
      .eq("is_active", true)
      .order("sort_order");
    topicRows = data ?? [];
  }

  const topicIds = topicRows.map((t) => t.id);
  let subtopicRows: Array<{
    id: string; topic_id: string; slug: string; title_en: string; title_bn: string; metadata: unknown; sort_order: number;
  }> = [];
  if (topicIds.length > 0) {
    const { data } = await supabase
      .from("subtopics")
      .select("id, topic_id, slug, title_en, title_bn, metadata, sort_order")
      .in("topic_id", topicIds)
      .eq("is_active", true)
      .order("sort_order");
    subtopicRows = data ?? [];
  }

  const subtopicsByTopic = new Map<string, SyllabusSubtopic[]>();
  for (const st of subtopicRows) {
    const list = subtopicsByTopic.get(st.topic_id) ?? [];
    list.push({
      id: st.id,
      slug: st.slug,
      title_bn: st.title_bn,
      title_en: st.title_en,
      priority: priorityOf(st.metadata),
    });
    subtopicsByTopic.set(st.topic_id, list);
  }

  const topicsBySubject = new Map<string, SyllabusTopic[]>();
  for (const t of topicRows) {
    const metadata = (t.metadata ?? {}) as Record<string, unknown>;
    const list = topicsBySubject.get(t.subject_id) ?? [];
    list.push({
      id: t.id,
      slug: t.slug,
      title_bn: t.title_bn,
      title_en: t.title_en,
      priority: typeof metadata.priority === "string" ? metadata.priority : null,
      priority_mix: typeof metadata.priority_mix === "string" ? metadata.priority_mix : null,
      subtopics: subtopicsByTopic.get(t.id) ?? [],
    });
    topicsBySubject.set(t.subject_id, list);
  }

  const mappedSubjects: SyllabusSubject[] = subjects.map((s) => {
    const topics = topicsBySubject.get(s.id) ?? [];
    const priority_counts = { P1: 0, P2: 0, P3: 0 };
    let subtopic_count = 0;
    for (const topic of topics) {
      for (const st of topic.subtopics) {
        subtopic_count += 1;
        if (st.priority) priority_counts[st.priority] += 1;
      }
    }
    return {
      id: s.id,
      slug: s.slug,
      title_bn: s.title_bn,
      title_en: s.title_en,
      weight: num(s.weight),
      topics,
      subtopic_count,
      priority_counts,
    };
  });

  return {
    courseId: course.id,
    subjects: mappedSubjects,
    marks: (markRows ?? []).map((m) => ({
      id: m.id,
      stage: m.stage,
      stage_bn: m.stage_bn,
      paper_bn: m.paper_bn,
      question_count: m.question_count === null ? null : num(m.question_count),
      marks_per_question: m.marks_per_question === null ? null : num(m.marks_per_question),
      negative_marks: num(m.negative_marks),
      duration_minutes: m.duration_minutes === null ? null : num(m.duration_minutes),
      total_marks: num(m.total_marks),
      pass_marks: m.pass_marks === null ? null : num(m.pass_marks),
      note_bn: m.note_bn ?? "",
    })),
    totals: {
      marks: mappedSubjects.reduce((sum, s) => sum + s.weight, 0),
      topics: topicRows.length,
      subtopics: subtopicRows.length,
    },
  };
}

/** Every published course that already carries a syllabus outline, for the index page. */
export async function listSyllabusCourses(): Promise<
  Array<{ id: string; slug: string; title_bn: string; subjects: number; topics: number; subtopics: number; marks: number }>
> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data: courses } = await supabase
    .from("courses")
    .select("id, slug, title_bn, sort_order")
    .eq("status", "published")
    .order("sort_order");
  if (!courses?.length) return [];

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, course_id, weight")
    .in("course_id", courses.map((c) => c.id))
    .eq("is_active", true);
  const subjectRows = subjects ?? [];
  const subjectIds = subjectRows.map((s) => s.id);

  const { data: topics } = subjectIds.length
    ? await supabase.from("topics").select("id, subject_id").in("subject_id", subjectIds).eq("is_active", true)
    : { data: [] as Array<{ id: string; subject_id: string }> };
  const topicRows = topics ?? [];
  const topicIds = topicRows.map((t) => t.id);

  const { data: subtopics } = topicIds.length
    ? await supabase.from("subtopics").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true)
    : { data: [] as Array<{ id: string; topic_id: string }> };
  const subtopicRows = subtopics ?? [];

  const subjectToCourse = new Map(subjectRows.map((s) => [s.id, s.course_id]));
  const topicToCourse = new Map(topicRows.map((t) => [t.id, subjectToCourse.get(t.subject_id)]));

  return courses
    .map((course) => {
      const courseSubjects = subjectRows.filter((s) => s.course_id === course.id);
      const courseTopics = topicRows.filter((t) => subjectToCourse.get(t.subject_id) === course.id);
      const courseSubtopics = subtopicRows.filter((st) => topicToCourse.get(st.topic_id) === course.id);
      return {
        id: course.id,
        slug: course.slug,
        title_bn: course.title_bn,
        subjects: courseSubjects.length,
        topics: courseTopics.length,
        subtopics: courseSubtopics.length,
        marks: courseSubjects.reduce((sum, s) => sum + num(s.weight), 0),
      };
    })
    .filter((course) => course.topics > 0);
}
