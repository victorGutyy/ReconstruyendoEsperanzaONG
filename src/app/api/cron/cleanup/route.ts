import { NextResponse } from "next/server";

import { isCronRequestAuthorized } from "@/lib/auth/cron";
import { getServerEnv } from "@/lib/env/server";
import { runDailyCleanup } from "@/modules/retention";

// Daily retention (step 9.3): Vercel Cron calls it (vercel.json) with the
// secret; it answers counts only, never personal data.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers.get("authorization"), getServerEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    return NextResponse.json(await runDailyCleanup(), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "cleanup failed" }, { status: 500, headers: NO_STORE });
  }
}
