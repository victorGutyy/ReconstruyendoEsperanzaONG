import { beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMITS, type RateLimitResult } from "@/lib/rate-limit/types";

vi.mock("server-only", () => ({}));

const requirePermission = vi.fn();
vi.mock("./session", () => ({ requirePermission }));

const limit = vi.fn<(rule: unknown, key: string) => Promise<RateLimitResult>>();
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS,
  getRateLimiter: () => ({ limit }),
  rateLimitKey: (...parts: string[]) => parts.join("|"),
}));

const { authorizeAction, TOO_MANY_ACTIONS } = await import("./guard");
const { AuthError } = await import("./errors");

const auth = { user: { id: "user-1" }, profile: {} };

describe("authorizeAction", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    limit.mockReset();
  });

  it("counts every authorized panel action against the user's limit (step 9.2)", async () => {
    requirePermission.mockResolvedValue(auth);
    limit.mockResolvedValue({ success: true, retryAfterSeconds: 0 });
    expect(await authorizeAction("content.read")).toEqual({ ok: true, auth });
    expect(limit).toHaveBeenCalledWith(RATE_LIMITS.panelActions, "user-1");
  });

  it("refuses once the limit is reached, or when the limiter is down", async () => {
    requirePermission.mockResolvedValue(auth);
    limit.mockResolvedValue({ success: false, retryAfterSeconds: 60, unavailable: true });
    expect(await authorizeAction("content.read")).toEqual({ ok: false, error: TOO_MANY_ACTIONS });
  });

  it("does not spend the limit on someone without permission", async () => {
    requirePermission.mockRejectedValue(new AuthError("FORBIDDEN"));
    expect(await authorizeAction("users.manage")).toEqual({
      ok: false,
      error: "No tienes permiso para hacer esto.",
    });
    expect(limit).not.toHaveBeenCalled();
  });
});
