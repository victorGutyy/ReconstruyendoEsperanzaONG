import { describe, expect, it } from "vitest";

import { MemoryRateLimiter } from "./memory";

const rule = { name: "test", limit: 3, windowSeconds: 60 };

describe("MemoryRateLimiter", () => {
  it("allows up to the limit and then blocks", async () => {
    const limiter = new MemoryRateLimiter(() => 0);

    for (let i = 0; i < 3; i++) {
      expect((await limiter.limit(rule, "a")).success).toBe(true);
    }
    expect(await limiter.limit(rule, "a")).toEqual({ success: false, retryAfterSeconds: 60 });
  });

  it("counts each key separately", async () => {
    const limiter = new MemoryRateLimiter(() => 0);

    for (let i = 0; i < 3; i++) await limiter.limit(rule, "a");

    expect((await limiter.limit(rule, "b")).success).toBe(true);
  });

  it("allows again once the window has passed", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(() => now);

    for (let i = 0; i < 3; i++) await limiter.limit(rule, "a");
    expect((await limiter.limit(rule, "a")).success).toBe(false);

    now = 60_000;
    expect((await limiter.limit(rule, "a")).success).toBe(true);
  });
});
