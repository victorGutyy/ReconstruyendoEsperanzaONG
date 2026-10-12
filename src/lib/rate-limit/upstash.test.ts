import { describe, expect, it, vi } from "vitest";

import { RATE_LIMITS } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));

// What the Upstash library answers: replaced per test. A plain function, not
// vi.fn(): Vitest reports a vi.fn() that throws even when the code catches it
let answer: () => Promise<unknown> = async () => ({});
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    limit = () => answer();
  },
}));

const { UpstashRateLimiter } = await import("./upstash");
const limiter = new UpstashRateLimiter("https://redis.test", "token");
const rule = RATE_LIMITS.loginPerAccount;

describe("UpstashRateLimiter", () => {
  it("passes the library's answer through", async () => {
    answer = async () => ({ success: true, reset: 0 });
    expect(await limiter.limit(rule, "key")).toEqual({ success: true, retryAfterSeconds: 0 });
  });

  it("refuses when the library lets a request through only because Redis was slow", async () => {
    // @upstash/ratelimit resolves success: true after its timeout (step 9.2)
    answer = async () => ({ success: true, reset: 0, reason: "timeout" });
    expect(await limiter.limit(rule, "key")).toMatchObject({ success: false, unavailable: true });
  });

  it("refuses when Redis fails", async () => {
    answer = async () => {
      throw new Error("network");
    };
    expect(await limiter.limit(rule, "key")).toMatchObject({ success: false, unavailable: true });
  });

  it("tells a reached limit apart from an outage", async () => {
    answer = async () => ({ success: false, reset: Date.now() + 30_000 });
    const result = await limiter.limit(rule, "key");
    expect(result.success).toBe(false);
    expect(result.unavailable).toBeUndefined();
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
