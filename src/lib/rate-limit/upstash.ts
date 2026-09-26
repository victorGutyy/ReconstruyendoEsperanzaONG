import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { RateLimiter, RateLimitResult, RateLimitRule } from "./types";

export class UpstashRateLimiter implements RateLimiter {
  private readonly redis: Redis;
  private readonly limiters = new Map<string, Ratelimit>();

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  private limiterFor(rule: RateLimitRule): Ratelimit {
    let limiter = this.limiters.get(rule.name);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
        prefix: `rl:${rule.name}`,
      });
      this.limiters.set(rule.name, limiter);
    }
    return limiter;
  }

  async limit(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
    try {
      const result = await this.limiterFor(rule).limit(key);
      return {
        success: result.success,
        retryAfterSeconds: result.success ? 0 : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch {
      // Fail closed (docs/05 §7): if Upstash does not answer, sensitive actions are refused
      return { success: false, retryAfterSeconds: 60 };
    }
  }
}
