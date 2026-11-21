import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(79)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "slug শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন হতে পারে।");

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
  }),
});

const bodySchema = z.discriminatedUnion("entity", [courseSchema, subjectSchema, topicSchema, subtopicSchema]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "taxonomy.manage")) {
    return NextResponse.json({ error: "ট্যাক্সোনমি পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

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
    const query = data.id
      ? supabase.from("subjects").update(payload).eq("id", data.id)
      : supabase.from("subjects").insert(payload);
    const { data: row, error } = await query.select("id, slug").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ subject: row }, { headers: { "Cache-Control": "no-store" } });
  }

  if (data.entity === "topic") {
    const payload = {
      subject_id: data.values.subjectId,
      slug: data.values.slug,
      title_en: data.values.titleEn,
      title_bn: data.values.titleBn,
      sort_order: data.values.sortOrder,
      is_active: data.values.isActive,
    };
    const query = data.id
      ? supabase.from("topics").update(payload).eq("id", data.id)
      : supabase.from("topics").insert(payload);
    const { data: row, error } = await query.select("id, slug").single();
    if (error) return fromDbError(error);
    return NextResponse.json({ topic: row }, { headers: { "Cache-Control": "no-store" } });
  }

  const payload = {
    topic_id: data.values.topicId,
    slug: data.values.slug,
    title_en: data.values.titleEn,
    title_bn: data.values.titleBn,
    sort_order: data.values.sortOrder,
    is_active: data.values.isActive,
  };
  const query = data.id
    ? supabase.from("subtopics").update(payload).eq("id", data.id)
    : supabase.from("subtopics").insert(payload);
  const { data: row, error } = await query.select("id").single();
  if (error) return fromDbError(error);
  return NextResponse.json({ subtopic: row }, { headers: { "Cache-Control": "no-store" } });
}
