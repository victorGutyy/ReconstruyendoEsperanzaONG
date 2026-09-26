import "server-only";

import { headers } from "next/headers";

/**
 * Client IP for rate limiting only (never stored in clear text, see rateLimitKey).
 * On Vercel the first x-forwarded-for entry is set by the platform.
 */
export async function getClientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}
