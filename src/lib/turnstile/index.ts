import "server-only";

import { getServerEnv, isLocalRuntime as isLocal } from "@/lib/env/server";

// Cloudflare Turnstile (step 8.7, docs/05 §7): antispam for the contact form
// without an annoying CAPTCHA. Its secret never leaves the server.

// Published by Cloudflare for automated tests: they always pass
// (developers.cloudflare.com/turnstile/troubleshooting/testing)
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The site key for the widget, or null: without it the form stays closed. */
export function turnstileSiteKey(): string | null {
  return getServerEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? (isLocal() ? TEST_SITE_KEY : null);
}

/**
 * Asks Cloudflare whether the widget's token is real. Fails closed: no
 * secret, no answer or any error means "no".
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = getServerEnv().TURNSTILE_SECRET_KEY ?? (isLocal() ? TEST_SECRET_KEY : null);
  if (!secret || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
