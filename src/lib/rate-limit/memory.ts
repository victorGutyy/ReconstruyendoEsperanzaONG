import type { RateLimiter, RateLimitResult, RateLimitRule } from "./types";

/**
 * Sliding-window limiter kept in this process's memory. Only valid with a single
 * server process (local development and CI); never on Vercel, where each request
 * may hit a different instance.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  async limit(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
    const bucket = `${rule.name}:${key}`;
    const now = this.now();
    const windowMs = rule.windowSeconds * 1000;
    const recent = (this.hits.get(bucket) ?? []).filter((time) => now - time < windowMs);

    if (recent.length >= rule.limit) {
      this.hits.set(bucket, recent);
      const oldest = recent[0] ?? now;
      return { success: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
    }

    recent.push(now);
    this.hits.set(bucket, recent);
    return { success: true, retryAfterSeconds: 0 };
  }
}
