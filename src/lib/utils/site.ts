import "server-only";

import { headers } from "next/headers";

/**
 * Origin used to build links sent by e-mail. Never trusts the Host header on
 * Vercel (host header injection): it uses NEXT_PUBLIC_SITE_URL, or the branch
 * URL Vercel provides. The request origin is only used locally and in CI.
 * Supabase additionally ignores any redirect not in its allow list.
 */
export async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;

  const list = await headers();
  const host = list.get("host") ?? "127.0.0.1:3000";
  const protocol = host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
