import { createHash, timingSafeEqual } from "node:crypto";

// Scheduled jobs (step 7.5b). Vercel Cron sends "Authorization: Bearer
// <CRON_SECRET>". Pure: unit-tested in cron.test.ts.

/** Shorter secrets are refused: the job stays closed until a strong one is set. */
export const MIN_CRON_SECRET_LENGTH = 32;

const digest = (text: string) => createHash("sha256").update(text).digest();

/** Constant-time check; closed when the secret is missing or weak. */
export function isCronRequestAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH || !authorization) return false;
  // Same-length digests: the comparison time does not depend on the input
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
