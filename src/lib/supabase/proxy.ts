import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { RouteSession } from "@/lib/auth/rules";
import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookies for the request and reads the claims.
 * Used only by src/proxy.ts.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; session: RouteSession }> {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Responses that set auth cookies must never be cached (@supabase/ssr)
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Nothing may run between creating the client and getClaims() (@supabase/ssr)
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return {
    response,
    session: claims?.sub ? { aal: claims.aal === "aal2" ? "aal2" : "aal1" } : null,
  };
}

/** A redirect that keeps the refreshed session cookies and no-cache headers. */
export function redirectWithSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
