import type { NextRequest } from "next/server";

import { decideAdminRoute } from "@/lib/auth/rules";
import { getPublicEnv } from "@/lib/env/public";
import { contentSecurityPolicy, CSP_HEADER, createNonce } from "@/lib/security/headers";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

// Optimistic checks only (Next.js 16 Proxy). The real authorization runs in
// src/lib/auth/session.ts inside every Server Component and Server Action.
export async function proxy(request: NextRequest) {
  // Strict CSP for the panel (step 9.1): Next reads the nonce from this
  // request header and puts it on its own scripts
  const csp = contentSecurityPolicy({
    supabaseUrl: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    nonce: createNonce(),
    dev: process.env.NODE_ENV === "development",
  });
  request.headers.set(CSP_HEADER, csp);

  const { response, session } = await updateSession(request);
  response.headers.set(CSP_HEADER, csp);

  const decision = decideAdminRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    session,
  });

  if (decision.type === "next") return response;
  return redirectWithSession(new URL(decision.to, request.url), response);
}

// Only the panel: the public site stays cacheable and never touches the session.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
