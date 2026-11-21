import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await getServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}
