import { type NextRequest, NextResponse } from "next/server";

import { RECOVERY_PATH, RESET_PASSWORD_PATH } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";

/**
 * Redirect on the same host the browser used. request.url may be normalised to
 * another host name (e.g. localhost vs 127.0.0.1), and the session cookie set
 * here would then not travel with the redirect. Only a path is appended, so the
 * Host header cannot send the user anywhere else.
 */
function sameHostRedirect(request: NextRequest, path: string) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.nextUrl.protocol;
  return NextResponse.redirect(new URL(path, `${protocol}//${host}`));
}

/**
 * Landing point of the recovery e-mail: exchanges the one-time token_hash for a
 * session (works even if the link is opened on another device) and continues to
 * the new password form. Only the recovery type is accepted here.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return sameHostRedirect(request, RESET_PASSWORD_PATH);
  }

  // Expired, already used or tampered link
  return sameHostRedirect(request, `${RECOVERY_PATH}?enlace=invalido`);
}
