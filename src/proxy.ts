import type { NextRequest } from "next/server";

import { decideAdminRoute } from "@/lib/auth/rules";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

// Optimistic checks only (Next.js 16 Proxy). The real authorization runs in
// src/lib/auth/session.ts inside every Server Component and Server Action.
export async function proxy(request: NextRequest) {
  const { response, session } = await updateSession(request);

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
