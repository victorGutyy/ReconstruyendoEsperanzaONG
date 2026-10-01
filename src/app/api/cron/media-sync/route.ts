import { NextResponse } from "next/server";

import { isCronRequestAuthorized } from "@/lib/auth/cron";
import { getServerEnv } from "@/lib/env/server";
import { syncPublicMedia } from "@/modules/media";

// Daily safety net for public photos (step 7.5b): takes out photos whose
// authorization expired and retries copies that failed. Vercel Cron calls it
// (vercel.json) with the secret; it answers counts only, never personal data.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers.get("authorization"), getServerEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const report = await syncPublicMedia();
    return NextResponse.json(
      { published: report.published, withdrawn: report.withdrawn, failed: report.failed.length },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ error: "sync failed" }, { status: 500, headers: NO_STORE });
  }
}
