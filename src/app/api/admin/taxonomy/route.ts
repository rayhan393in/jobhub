import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(79)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "slug শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন হতে পারে।");

const approvalStatus = z.enum(["pending", "approved", "rejected"]);

const occurrenceYears = z
  .array(z.number().int().min(1971).max(2100))
  .max(80)
  .optional();

const courseSchema = z.object({
  entity: z.literal("course"),
  id: z.string().uuid().optional(),
  values: z.object({
    slug,
    titleEn: z.string().trim().min(2).max(120),
    titleBn: z.string().trim().min(2).max(120),
    summaryBn: z.string().trim().max(400).optional().default(""),
    level: z.enum(["foundation", "intermediate", "advanced"]).default("foundation"),
    icon: z.string().trim().max(40).default("graduation-cap"),
    accent: z.enum(["indigo", "violet", "mint"]).default("indigo"),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    sortOrder: z.number().int().min(0).max(999).default(0),
  }),
});

const subjectSchema = z.object({
  entity: z.literal("subject"),
  id: z.string().uuid().optional(),
  values: z.object({
    courseId: z.string().uuid(),
    slug,
    titleEn: z.string().trim().min(2).max(120),
    titleBn: z.string().trim().min(2).max(120),
    weight: z.number().int().min(1).max(100).default(1),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
  }),
});

const topicSchema = z.object({
  entity: z.literal("topic"),
  id: z.string().uuid().optional(),
  values: z.object({
    subjectId: z.string().uuid(),
    slug,
    titleEn: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().min(2).max(160),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
    approvalStatus: approvalStatus.optional(),
    sourceUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
    occurrenceYears,
    canonicalId: z.string().uuid().nullable().optional(),
  }),
});

const subtopicSchema = z.object({
  entity: z.literal("subtopic"),
  id: z.string().uuid().optional(),
  values: z.object({
    topicId: z.string().uuid(),
    slug,
    titleEn: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().min(2).max(160),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
    approvalStatus: approvalStatus.optional(),
  }),
});

const microTopicSchema = z.object({
  entity: z.literal("micro_topic"),
  id: z.string().uuid().optional(),
  values: z.object({
    subtopicId: z.string().uuid(),
    slug,
    titleEn: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().min(2).max(160),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
    approvalStatus: approvalStatus.optional(),
  }),
});

const canonicalSchema = z.object({
  entity: z.literal("canonical_topic"),
  id: z.string().uuid().optional(),
  values: z.object({
    slug,
    titleEn: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().min(2).max(160),
    subjectGroup: z.string().trim().max(120).optional().default(""),
  }),
});

const bodySchema = z.discriminatedUnion("entity", [
  courseSchema,
  subjectSchema,
  topicSchema,
  subtopicSchema,
  microTopicSchema,
  canonicalSchema,
]);

async function requireManager() {
  return requireApiPermission("taxonomy.manage", {
    message: "ট্যাক্সোনমি পরিবর্তনের অনুমতি নেই।",
  });
}

/**
 * GET ?courseId=… — the full admin view of one course's syllabus tree,
 * including pending/rejected rows that student queries never see.
 * Also returns the central canonical-topic library (course-agnostic).
 */
export async function GET(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId || !z.string().uuid().safeParse(courseId).success) {
    return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .select("id, course_id, slug, title_en, title_bn, weight, sort_order, is_active")
    .eq("course_id", courseId)
    .order("sort_order");
  if (subjectError) return fromDbError(subjectError);

  const subjectIds = (subjects ?? []).map((s) => s.id);
  let topics: unknown[] = [];
  let subtopics: unknown[] = [];
  let microTopics: unknown[] = [];

  if (subjectIds.length > 0) {
    const { data: topicRows, error: topicError } = await supabase
      .from("topics")
      .select(
        "id, subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, source_url, occurrence_years, canonical_id",
      )
      .in("subject_id", subjectIds)
      .order("sort_order");
    if (topicError) return fromDbError(topicError);
    topics = topicRows ?? [];

    const topicIds = (topicRows ?? []).map((t) => t.id);
    if (topicIds.length > 0) {
      const { data: subtopicRows } = await supabase
        .from("subtopics")
        .select("id, topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status")
        .in("topic_id", topicIds)
        .order("sort_order");
      subtopics = subtopicRows ?? [];

      const subtopicIds = (subtopicRows ?? []).map((s) => s.id);
      if (subtopicIds.length > 0) {
        const { data: microRows } = await supabase
          .from("micro_topics")
          .select("id, subtopic_id, slug, title_en, title_bn, sort_order, is_active, approval_status")
          .in("subtopic_id", subtopicIds)
          .order("sort_order");
        microTopics = microRows ?? [];
      }
    }
  }

  const { data: canonical } = await supabase
    .from("canonical_topics")
    .select("id, slug, title_en, title_bn, subject_group")
    .order("subject_group", { ascending: true, nullsFirst: false })
    .order("title_bn");

  return NextResponse.json(
    { subjects: subjects ?? [], topics, subtopics, microTopics, canonicalTopics: canonical ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;
  const user = gate.user;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const data = parsed.data;

  if (data.entity === "course") {
    const payload = {
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      summary_bn: data.values.summaryBn || null,
      level: data.values.level,
      icon: data.values.icon,
      accent: data.values.accent,
      status: data.values.status,
      sort_order: data.values.sortOrder,
    };
    const query = data.id
      ? supabase.from("courses").update(payload).eq("id", data.id)
      : supabase.from("courses").insert({ ...payload, created_by: user.id });
    const { data: row, error } = await query.select("id, slug, status").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ course: row }, { headers: { "Cache-Control": "no-store" } });
  }

  if (data.entity === "subject") {
    const payload = {
      course_id: data.values.courseId,
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      weight: data.values.weight,
      sort_order: data.values.sortOrder,
      is_active: data.values.isActive,
    };
    if (!data.id) {
      const { data: dupe } = await supabase
        .from("subjects")
        .select("id")
        .eq("course_id", data.values.courseId)
        .or(`slug.eq.${data.values.slug},title_bn.eq.${data.values.titleBn.replaceAll(",", "")}`)
        .limit(1);
      if (dupe && dupe.length > 0) {
        return NextResponse.json(
          { error: "এই কোর্সে একই নাম বা slug-এর বিষয় ইতিমধ্যেই আছে।" },
          { status: 409 },
        );
      }
    }
    const query = data.id
      ? supabase.from("subjects").update(payload).eq("id", data.id)
      : supabase.from("subjects").insert(payload);
    const { data: row, error } = await query.select("id, slug").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ subject: row }, { headers: { "Cache-Control": "no-store" } });
  }

  if (data.entity === "topic") {
    const payload: Record<string, unknown> = {
      subject_id: data.values.subjectId,
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      sort_order: data.values.sortOrder,
      is_active: data.values.isActive,
    };
    if (data.values.approvalStatus) payload.approval_status = data.values.approvalStatus;
    if (data.values.sourceUrl !== undefined) payload.source_url = data.values.sourceUrl || null;
    if (data.values.occurrenceYears !== undefined) payload.occurrence_years = data.values.occurrenceYears;
    if (data.values.canonicalId !== undefined) payload.canonical_id = data.values.canonicalId;

    if (!data.id) {
      const { data: dupe } = await supabase
        .from("topics")
        .select("id, title_bn")
        .eq("subject_id", data.values.subjectId)
        .or(`slug.eq.${data.values.slug},title_bn.eq.${data.values.titleBn.replaceAll(",", "")}`)
        .limit(1);
      if (dupe && dupe.length > 0) {
        return NextResponse.json(
          { error: `ডুপ্লিকেট: এই বিষয়ে "${dupe[0].title_bn}" নামে/slug-এ টপিক ইতিমধ্যেই আছে।` },
          { status: 409 },
        );
      }
    }
    const query = data.id
      ? supabase.from("topics").update(payload).eq("id", data.id)
      : supabase.from("topics").insert(payload);
    const { data: row, error } = await query.select("id, slug").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ topic: row }, { headers: { "Cache-Control": "no-store" } });
  }

  if (data.entity === "subtopic") {
    const payload: Record<string, unknown> = {
      topic_id: data.values.topicId,
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      sort_order: data.values.sortOrder,
      is_active: data.values.isActive,
    };
    if (data.values.approvalStatus) payload.approval_status = data.values.approvalStatus;
    if (!data.id) {
      const { data: dupe } = await supabase
        .from("subtopics")
        .select("id, title_bn")
        .eq("topic_id", data.values.topicId)
        .or(`slug.eq.${data.values.slug},title_bn.eq.${data.values.titleBn.replaceAll(",", "")}`)
        .limit(1);
      if (dupe && dupe.length > 0) {
        return NextResponse.json(
          { error: `ডুপ্লিকেট: এই টপিকে "${dupe[0].title_bn}" ইতিমধ্যেই আছে।` },
          { status: 409 },
        );
      }
    }
    const query = data.id
      ? supabase.from("subtopics").update(payload).eq("id", data.id)
      : supabase.from("subtopics").insert(payload);
    const { data: row, error } = await query.select("id").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ subtopic: row }, { headers: { "Cache-Control": "no-store" } });
  }

  if (data.entity === "micro_topic") {
    const payload: Record<string, unknown> = {
      subtopic_id: data.values.subtopicId,
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      sort_order: data.values.sortOrder,
      is_active: data.values.isActive,
    };
    if (data.values.approvalStatus) payload.approval_status = data.values.approvalStatus;
    const query = data.id
      ? supabase.from("micro_topics").update(payload).eq("id", data.id)
      : supabase.from("micro_topics").insert(payload);
    const { data: row, error } = await query.select("id").single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "এই সাব-টপিকে একই slug-এর মাইক্রো-টপিক আছে।" }, { status: 409 });
      }
      return fromDbError(error);
    }
    return NextResponse.json({ microTopic: row }, { headers: { "Cache-Control": "no-store" } });
  }

  // canonical_topic
  const payload = {
    slug: data.values.slug,
    title_en: data.values.titleEn,
    title_bn: data.values.titleBn,
    subject_group: data.values.subjectGroup || null,
  };
  const query = data.id
    ? supabase.from("canonical_topics").update(payload).eq("id", data.id)
    : supabase.from("canonical_topics").insert(payload);
  const { data: row, error } = await query.select("id, slug").single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "এই slug-এর কমন টপিক ইতিমধ্যেই লাইব্রেরিতে আছে।" }, { status: 409 });
    }
    return fromDbError(error);
  }
  return NextResponse.json({ canonicalTopic: row }, { headers: { "Cache-Control": "no-store" } });
}

const reviewSchema = z.object({
  entity: z.enum(["topic", "subtopic", "micro_topic"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["approve", "reject"]),
});

/**
 * PATCH — approve or reject pending taxonomy rows (bulk-friendly).
 * Approval re-activates the row; rejection keeps it hidden from students.
 */
export async function PATCH(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const table =
    parsed.data.entity === "topic" ? "topics" : parsed.data.entity === "subtopic" ? "subtopics" : "micro_topics";
  const approve = parsed.data.action === "approve";

  const { data: rows, error } = await supabase
    .from(table)
    .update({ approval_status: approve ? "approved" : "rejected", is_active: approve })
    .in("id", parsed.data.ids)
    .select(table === "topics" ? "id, subject_id" : "id");
  if (error) return fromDbError(error);

  // Approving a topic should also wake up its (still-inactive) subject, so a
  // freshly reviewed syllabus goes live without a second manual step.
  if (approve && table === "topics") {
    const subjectIds = [
      ...new Set((rows ?? []).map((row) => (row as { subject_id?: string }).subject_id).filter(Boolean)),
    ] as string[];
    if (subjectIds.length > 0) {
      await supabase.from("subjects").update({ is_active: true }).in("id", subjectIds).eq("is_active", false);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: gate.user.id,
    action: `taxonomy.${parsed.data.action}`,
    entity_type: table,
    entity_id: parsed.data.ids[0],
    details: { count: rows?.length ?? 0 },
  });

  return NextResponse.json(
    { updated: rows?.length ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const deleteSchema = z.object({
  entity: z.enum(["subject", "topic", "subtopic", "micro_topic", "canonical_topic"]),
  id: z.string().uuid(),
});

/**
 * DELETE — remove a taxonomy row outright, with safety guards:
 * anything referenced by questions or routines is refused (deactivate or
 * reject instead), so no exam/practice content can lose its labels.
 */
export async function DELETE(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { entity, id } = parsed.data;

  async function countRef(table: string, column: string, value: string) {
    const { count } = await supabase!
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    return count ?? 0;
  }

  if (entity === "subject") {
    if ((await countRef("topics", "subject_id", id)) > 0) {
      return NextResponse.json(
        { error: "এই বিষয়ের অধীনে টপিক আছে — আগে টপিকগুলো সরান বা নিষ্ক্রিয় করুন।" },
        { status: 409 },
      );
    }
    if ((await countRef("questions", "subject_id", id)) > 0) {
      return NextResponse.json(
        { error: "এই বিষয়ে প্রশ্ন আছে — মুছলে প্রশ্নব্যাংক লেবেল হারাবে। নিষ্ক্রিয় করুন।" },
        { status: 409 },
      );
    }
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return fromDbError(error);
  } else if (entity === "topic") {
    if ((await countRef("questions", "topic_id", id)) > 0) {
      return NextResponse.json(
        { error: "এই টপিকে প্রশ্ন আছে — মুছলে প্রশ্নব্যাংক লেবেল হারাবে। রিজেক্ট/নিষ্ক্রিয় করুন।" },
        { status: 409 },
      );
    }
    if ((await countRef("routines", "topic_id", id)) > 0) {
      return NextResponse.json(
        { error: "এই টপিক রুটিনে ব্যবহার হয়েছে — মুছলে রুটিন ভাঙবে। নিষ্ক্রিয় করুন।" },
        { status: 409 },
      );
    }
    // Children first (micro_topics cascade from subtopics).
    const { data: childSubtopics } = await supabase.from("subtopics").select("id").eq("topic_id", id);
    if (childSubtopics && childSubtopics.length > 0) {
      const { error: subError } = await supabase.from("subtopics").delete().eq("topic_id", id);
      if (subError) return fromDbError(subError);
    }
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) return fromDbError(error);
  } else if (entity === "subtopic") {
    if ((await countRef("questions", "subtopic_id", id)) > 0) {
      return NextResponse.json(
        { error: "এই সাব-টপিকে প্রশ্ন আছে — মুছলে প্রশ্নব্যাংক লেবেল হারাবে। নিষ্ক্রিয় করুন।" },
        { status: 409 },
      );
    }
    const { error } = await supabase.from("subtopics").delete().eq("id", id);
    if (error) return fromDbError(error);
  } else if (entity === "micro_topic") {
    const { error } = await supabase.from("micro_topics").delete().eq("id", id);
    if (error) return fromDbError(error);
  } else {
    // canonical_topic — course topics keep working (canonical_id becomes NULL).
    const { error } = await supabase.from("canonical_topics").delete().eq("id", id);
    if (error) return fromDbError(error);
  }

  await supabase.from("audit_logs").insert({
    actor_id: gate.user.id,
    action: "taxonomy.delete",
    entity_type: entity,
    entity_id: id,
    details: {},
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
