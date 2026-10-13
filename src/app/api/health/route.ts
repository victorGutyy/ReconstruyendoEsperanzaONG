import { NextResponse } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";

// Health check (step 9.7): for the uptime monitor, and daily activity so the
// free Supabase plan never pauses the project (docs/03 §6). It reads one
// public row as a visitor would and answers only "ok" or "error": no data,
// no details about what failed.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { error } = await createPublicClient()
      .from("site_settings")
      .select("updated_at", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers: NO_STORE });
  }
}
