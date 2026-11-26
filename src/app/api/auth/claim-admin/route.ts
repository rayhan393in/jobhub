import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/claim-admin
 *
 * Promotes the signed-in caller to super_admin **only** while the platform has
 * no staff member at all. The real check lives in `jh_claim_first_admin()`, so
 * this route cannot be used to escalate on a live platform — it is a thin,
 * same-origin wrapper that turns database errors into useful messages.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  }

  // Only same-origin form posts; blocks cross-site privilege attempts.
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  if (isStaff(user.role)) {
    return NextResponse.json({ ok: true, role: user.role, alreadyStaff: true });
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("jh_claim_first_admin");

  if (error) {
    const message = error.message ?? "";
    if (/administrator already exists/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "এই প্ল্যাটফর্মে ইতিমধ্যে একজন অ্যাডমিন আছেন। অ্যাডমিন অ্যাক্সেস পেতে একজন বিদ্যমান অ্যাডমিনকে অনুরোধ করুন।",
        },
        { status: 409 },
      );
    }
    if (/permission denied|not authorized/i.test(message)) {
      return NextResponse.json({ error: "এই কাজটি করার অনুমতি নেই।" }, { status: 403 });
    }
    return NextResponse.json({ error: "অ্যাডমিন অ্যাক্সেস চালু করা যায়নি। আবার চেষ্টা করুন।" }, { status: 500 });
  }

  const result = (data ?? {}) as { claimed?: boolean; role?: string };
  return NextResponse.json({ ok: true, claimed: Boolean(result.claimed), role: result.role ?? "super_admin" });
}
