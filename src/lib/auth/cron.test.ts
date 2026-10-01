// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isCronRequestAuthorized } from "./cron";

const SECRET = "s".repeat(32);

describe("isCronRequestAuthorized", () => {
  it("accepts the bearer secret", () => {
    expect(isCronRequestAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses a missing or wrong header", () => {
    expect(isCronRequestAuthorized(null, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isCronRequestAuthorized("Bearer ", SECRET)).toBe(false);
  });

  it("stays closed without a strong secret", () => {
    expect(isCronRequestAuthorized("Bearer ", "")).toBe(false);
    expect(isCronRequestAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronRequestAuthorized("Bearer corto", "corto")).toBe(false);
  });
});
