import "server-only";

import { createHash } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

import { MemoryRateLimiter } from "./memory";
import type { RateLimiter } from "./types";
import { UpstashRateLimiter } from "./upstash";

export { RATE_LIMITS } from "./types";
export type { RateLimitResult, RateLimitRule } from "./types";

let limiter: RateLimiter | undefined;

/** Refuses everything: used when no real limiter is configured in the cloud (fail closed). */
const unavailable: RateLimiter = {
  async limit() {
    return { success: false, retryAfterSeconds: 60 };
  },
};

/**
 * Upstash when configured; the in-memory limiter only when explicitly allowed
 * with RATE_LIMIT_DRIVER=memory (local development and CI, single process);
 * otherwise sensitive actions fail closed.
 */
export function getRateLimiter(): RateLimiter {
  if (limiter) return limiter;
  const env = getServerEnv();

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    limiter = new UpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  } else if (env.RATE_LIMIT_DRIVER === "memory") {
    limiter = new MemoryRateLimiter();
  } else {
    limiter = unavailable;
  }
  return limiter;
}

/** Keys never store e-mails or IPs in clear text (docs/09 minimisation). */
export function rateLimitKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 32);
}
