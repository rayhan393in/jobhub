import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI question drafting (Gemini).
 *
 * Deliberately a *drafting* tool only: the route returns candidate rows in the
 * exact JSON shape the import pipeline accepts. Nothing is written to the
 * database here — the client sends the rows through /api/admin/import, so AI
 * questions always land as source_type='ai_assisted', status='pending_review',
 * is_verified=false and must be approved by a human like every other import.
 */

const schema = z.object({
  courseTitle: z.string().trim().min(2).max(120),
  subjectLabel: z.string().trim().min(2).max(120),
  topicLabel: z.string().trim().max(120).optional().default(""),
  count: z.number().int().min(1).max(25).default(10),
  difficulty: z.enum(["mixed", "easy", "medium", "hard"]).default("mixed"),
  instructions: z.string().trim().max(1000).optional().default(""),
});

type GeneratedRow = {
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  difficulty: string;
};

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.import")) {
    return NextResponse.json({ error: "AI প্রশ্ন তৈরির অনুমতি নেই।" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI কনফিগার করা নেই।",
        setup:
          "Google AI Studio (aistudio.google.com/apikey) থেকে ফ্রি API Key নিন, তারপর Vercel প্রজেক্টের Environment Variables-এ GEMINI_API_KEY নামে যোগ করে redeploy করুন।",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" }, { status: 422 });
  }
  const { courseTitle, subjectLabel, topicLabel, count, difficulty, instructions } = parsed.data;

  const difficultyLine =
    difficulty === "mixed"
      ? "difficulty মিশ্রিত রাখবে: প্রায় ৪০% easy, ৪০% medium, ২০% hard।"
      : `প্রতিটি প্রশ্নের difficulty হবে "${difficulty}"।`;

  const prompt = [
    `তুমি বাংলাদেশের ${courseTitle} পরীক্ষার একজন অভিজ্ঞ প্রশ্নকর্তা।`,
    `বিষয়: ${subjectLabel}${topicLabel ? ` — টপিক: ${topicLabel}` : ""}`,
    `ঠিক ${count}টি উচ্চমানের MCQ তৈরি করো। বিষয় বাংলা-মাধ্যম হলে প্রশ্ন বাংলায়, English হলে ইংরেজিতে লিখবে।`,
    "প্রতিটি প্রশ্নে ৪টি অপশন থাকবে, একটিই সঠিক উত্তর, এবং ১-২ বাক্যের ব্যাখ্যা থাকবে।",
    "তথ্যগতভাবে নিশ্চিত না হলে সেই প্রশ্ন বানাবে না; বিতর্কিত বা একাধিক সঠিক উত্তর হয় এমন প্রশ্ন নিষিদ্ধ।",
    difficultyLine,
    instructions ? `অতিরিক্ত নির্দেশনা: ${instructions}` : "",
    'শুধু একটি JSON array দেবে, অন্য কোনো টেক্সট নয়। প্রতিটি উপাদান: {"statement": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A"|"B"|"C"|"D", "explanation": "...", "difficulty": "easy"|"medium"|"hard"}',
  ]
    .filter(Boolean)
    .join("\n");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  let responseText = "";
  try {
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(50_000),
      },
    );
    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("[ai-generate] Gemini error", aiResponse.status, detail.slice(0, 400));
      return NextResponse.json(
        {
          error:
            aiResponse.status === 429
              ? "AI রেট লিমিটে পৌঁছেছে — কিছুক্ষণ পরে আবার চেষ্টা করুন।"
              : "AI সার্ভিস থেকে উত্তর আসেনি — API Key ও মডেল নাম ঠিক আছে কি না দেখুন।",
        },
        { status: 502 },
      );
    }
    const payload = (await aiResponse.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    responseText = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  } catch (error) {
    console.error("[ai-generate] fetch failed", (error as Error).message);
    return NextResponse.json({ error: "AI সার্ভিসে সংযোগ ব্যর্থ — আবার চেষ্টা করুন।" }, { status: 502 });
  }

  let rows: GeneratedRow[];
  try {
    const parsedJson: unknown = JSON.parse(responseText);
    if (!Array.isArray(parsedJson)) throw new Error("not an array");
    rows = parsedJson as GeneratedRow[];
  } catch {
    return NextResponse.json({ error: "AI-এর উত্তর পার্স করা যায়নি — আবার চেষ্টা করুন।" }, { status: 502 });
  }

  // Shape rows for the import pipeline. subject/topic labels ride along so the
  // importer's taxonomy resolver tags them automatically.
  const importRows = rows
    .filter(
      (row) =>
        row &&
        typeof row.statement === "string" &&
        row.statement.trim().length >= 8 &&
        [row.option_a, row.option_b, row.option_c, row.option_d].every(
          (opt) => typeof opt === "string" && opt.trim().length > 0,
        ) &&
        typeof row.correct_option === "string" &&
        /^[a-dA-D]$/.test(row.correct_option.trim()),
    )
    .slice(0, count)
    .map((row) => ({
      statement: row.statement.trim(),
      option_a: row.option_a.trim(),
      option_b: row.option_b.trim(),
      option_c: row.option_c.trim(),
      option_d: row.option_d.trim(),
      correct_option: row.correct_option.trim().toUpperCase(),
      explanation: typeof row.explanation === "string" ? row.explanation.trim() : "",
      difficulty: ["easy", "medium", "hard"].includes(row.difficulty) ? row.difficulty : "medium",
      source_type: "ai_assisted",
      source: `AI draft (${model})`,
      subject: subjectLabel,
      topic: topicLabel || "",
    }));

  if (importRows.length === 0) {
    return NextResponse.json({ error: "AI কোনো বৈধ প্রশ্ন দেয়নি — আবার চেষ্টা করুন।" }, { status: 502 });
  }

  return NextResponse.json(
    { rows: importRows, model, requested: count, produced: importRows.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
