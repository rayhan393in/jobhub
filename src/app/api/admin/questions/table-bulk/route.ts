import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiPermission } from "@/lib/api";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["approve", "reject", "archive", "restore", "submit"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Form-posted bulk action from the question-bank table (checkbox selection).
 * Runs through the audited `jh_bulk_review` RPC — the same transaction used by
 * the bulk workbench — then redirects back to the table with a status flag.
 */
export async function POST(request: Request) {
  // A form post, so failures redirect back into the admin UI rather than
  // rendering a bare JSON error page.
  const gate = await requireApiPermission("question.review");
  if ("error" in gate) {
    const target = gate.error.status === 401 ? "/login?next=/admin/questions" : "/admin?denied=question.review";
    return NextResponse.redirect(new URL(target, request.url), 303);
  }

  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const ids = form.getAll("ids").map(String).filter((id) => UUID.test(id)).slice(0, 500);
  const backRaw = String(form.get("back") ?? "/admin/questions");
  const back = backRaw.startsWith("/admin/questions") ? backRaw : "/admin/questions";

  const redirectBack = (flag: string) => {
    const url = new URL(back, request.url);
    url.searchParams.set("bulk", flag);
    return NextResponse.redirect(url, 303);
  };

  if (!ACTIONS.has(action) || ids.length === 0) return redirectBack("invalid");

  const supabase = await getServerClient();
  if (!supabase) return redirectBack("error");

  const { error } = await supabase.rpc("jh_bulk_review", {
    p_action: action,
    p_question_ids: ids,
    p_filters: {},
    p_notes: `question-bank table bulk (${ids.length})`,
  });
  if (error) {
    console.error("[admin] table-bulk", error.message);
    return redirectBack("error");
  }
  return redirectBack(`${action}:${ids.length}`);
}
