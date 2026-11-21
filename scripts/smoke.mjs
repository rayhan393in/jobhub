#!/usr/bin/env node
/**
 * Post-deploy smoke test: exercises the deployed app over HTTP the way a
 * browser would — anonymous reads, the auth guard on /admin, and the
 * server-authoritative exam contract.
 *
 *   npm run smoke -- https://your-preview.vercel.app
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY so it can
 * also prove the hosted backend answers (it never signs in, so it stays within
 * anonymous RLS).
 */

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("usage: npm run smoke -- https://preview.example.com");
  process.exit(1);
}

let failures = 0;
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "jobhub-smoke/1.0", ...(options.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), body };
}

async function main() {
  console.log(`smoke: ${base}\n`);

  // 1. Public marketing pages render with real Bangla copy.
  for (const path of ["/", "/courses", "/faq"]) {
    const { status, body } = await get(path);
    const bengali = /[\u0980-\u09FF]/.test(body);
    record(`GET ${path}`, status === 200 && bengali, `status ${status}, bangla ${bengali}`);
  }

  // 2. Anonymous visitors are redirected away from private areas.
  for (const path of ["/admin", "/dashboard", "/exam/00000000-0000-0000-0000-000000000000"]) {
    const { status, location } = await get(path);
    const redirected = status >= 300 && status < 400 && /\/login/.test(location || "");
    record(`guard ${path}`, redirected, `status ${status} -> ${location}`);
  }

  // 3. The sign-up route validates input server-side and never returns a token.
  const signUp = await fetch(`${base}/api/auth/sign-up`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "x", fullName: "" }),
    signal: AbortSignal.timeout(20_000),
  });
  const signUpBody = await signUp.text();
  record(
    "POST /api/auth/sign-up (invalid input)",
    signUp.status === 400 || signUp.status === 422,
    `status ${signUp.status}`,
  );
  record(
    "POST /api/auth/sign-up leaks no access token",
    !/access_token/.test(signUpBody),
    "payload checked",
  );

  // 4. The exam API must refuse anonymous callers instead of leaking a paper.
  const start = await fetch(`${base}/api/exams/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scheduleId: "00000000-0000-0000-0000-000000000000" }),
    signal: AbortSignal.timeout(20_000),
  });
  const startBody = await start.text();
  const answersLeaked = /"correct_option"|"explanation"/.test(startBody);
  record(
    "POST /api/exams/start (anonymous)",
    start.status >= 400 && start.status < 500 && !answersLeaked,
    `status ${start.status}, answer key leaked ${answersLeaked}`,
  );

  // 5. Hosted PostgREST answers anonymous reads for published catalogue rows.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    const response = await fetch(`${supabaseUrl}/rest/v1/courses?select=slug&status=eq.published`, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const rows = await response.json().catch(() => null);
    record(
      "hosted REST: published courses visible to anon",
      response.ok && Array.isArray(rows) && rows.length > 0,
      `status ${response.status}, rows ${Array.isArray(rows) ? rows.length : "n/a"}`,
    );

    // 6. Drafts must never be visible to an anonymous reader.
    const drafts = await fetch(`${supabaseUrl}/rest/v1/exam_schedules?select=id&status=eq.draft`, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const draftRows = await drafts.json().catch(() => null);
    record(
      "hosted REST: draft schedules hidden from anon",
      drafts.ok && Array.isArray(draftRows) && draftRows.length === 0,
      `status ${drafts.status}, rows ${Array.isArray(draftRows) ? draftRows.length : "n/a"}`,
    );
  } else {
    record("hosted REST checks", false, "NEXT_PUBLIC_SUPABASE_* not set");
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("smoke crashed:", error.message);
  process.exit(1);
});
