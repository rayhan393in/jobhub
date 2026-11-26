import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromDbError, assertSameOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * খাতা (answer sheet) uploads for written exams.
 *
 * POST   multipart/form-data { attemptId, file } → stores the page in the
 *        PRIVATE 'written-scripts' bucket and records it. Only the owner of
 *        an in-progress attempt may upload; images/PDF only, max 10 MB.
 * GET    ?attemptId → own uploads with short-lived signed URLs.
 * DELETE ?uploadId  → remove an own upload while still in progress.
 *
 * Storage access goes through the admin client AFTER the caller's ownership
 * is proven via RLS-scoped reads — the bucket itself stays private.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 }) };
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user, supabase };
}

export async function POST(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "ফাইল পাওয়া যায়নি।" }, { status: 422 });
  }
  const attemptId = String(form.get("attemptId") ?? "");
  const file = form.get("file");
  if (!attemptId || !(file instanceof File)) {
    return NextResponse.json({ error: "attemptId ও file দুটোই প্রয়োজন।" }, { status: 422 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "শুধু ছবি (JPG/PNG/WebP) বা PDF আপলোড করা যাবে।" }, { status: 422 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ফাইলের আকার সর্বোচ্চ ১০ MB।" }, { status: 422 });
  }

  // Ownership + state check through RLS: the row is only visible if it's ours.
  const { data: attempt, error: aErr } = await supabase
    .from("written_attempts")
    .select("id, status, exam_id, user_id")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();
  if (aErr) return fromDbError(aErr);
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "খাতাটি ইতিমধ্যে জমা হয়ে গেছে — আর আপলোড করা যাবে না।" }, { status: 422 });
  }

  const { count } = await supabase
    .from("written_uploads")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId);
  if ((count ?? 0) >= 40) {
    return NextResponse.json({ error: "প্রতি খাতায় সর্বোচ্চ ৪০টি পাতা আপলোড করা যায়।" }, { status: 422 });
  }

  const path = `${attempt.exam_id}/${attemptId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const admin = getAdminClient();
  const { error: upErr } = await admin.storage
    .from("written-scripts")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (upErr) return NextResponse.json({ error: `আপলোড ব্যর্থ: ${upErr.message}` }, { status: 500 });

  const { data: row, error: insErr } = await supabase
    .from("written_uploads")
    .insert({
      attempt_id: attemptId,
      storage_path: path,
      file_name: file.name || null,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (insErr) {
    await admin.storage.from("written-scripts").remove([path]);
    return fromDbError(insErr);
  }

  return NextResponse.json({ ok: true, uploadId: row.id });
}

export async function GET(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { supabase } = g;

  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return NextResponse.json({ error: "attemptId প্রয়োজন।" }, { status: 422 });

  // RLS: owner or staff only.
  const { data: uploads, error } = await supabase
    .from("written_uploads")
    .select("id, storage_path, file_name, mime_type, uploaded_at")
    .eq("attempt_id", attemptId)
    .order("uploaded_at", { ascending: true });
  if (error) return fromDbError(error);

  const admin = getAdminClient();
  const withUrls = await Promise.all(
    (uploads ?? []).map(async (u) => {
      const { data: signed } = await admin.storage
        .from("written-scripts")
        .createSignedUrl(u.storage_path, 60 * 30);
      return { ...u, signed_url: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ uploads: withUrls }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { supabase } = g;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const uploadId = new URL(request.url).searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ error: "uploadId প্রয়োজন।" }, { status: 422 });

  const { data: upload, error: selErr } = await supabase
    .from("written_uploads")
    .select("id, storage_path")
    .eq("id", uploadId)
    .single();
  if (selErr) return fromDbError(selErr);

  // RLS enforces owner+in_progress (or staff) on delete.
  const { error, count } = await supabase
    .from("written_uploads")
    .delete({ count: "exact" })
    .eq("id", uploadId);
  if (error) return fromDbError(error);
  if (!count) return NextResponse.json({ error: "মুছে ফেলা যায়নি।" }, { status: 403 });

  await getAdminClient().storage.from("written-scripts").remove([upload.storage_path]);
  return NextResponse.json({ ok: true });
}
