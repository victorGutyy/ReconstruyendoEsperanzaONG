import { describe, expect, it } from "vitest";

import { loginSchema, mfaCodeSchema } from "./schema";

describe("loginSchema", () => {
  it("normalises the e-mail", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Example.TEST ", password: "x" });
    expect(parsed.email).toBe("admin@example.test");
  });

  it("rejects an invalid e-mail and an empty password", () => {
    expect(loginSchema.safeParse({ email: "no-es-correo", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.test", password: "" }).success).toBe(false);
  });

  it("rejects absurdly long passwords", () => {
    expect(
      loginSchema.safeParse({ email: "a@example.test", password: "x".repeat(129) }).success,
    ).toBe(false);
  });
});

describe("mfaCodeSchema", () => {
  const factorId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("accepts a 6-digit code", () => {
    expect(mfaCodeSchema.safeParse({ factorId, code: " 123456 " }).success).toBe(true);
  });

  it.each(["12345", "1234567", "12a456", ""])("rejects the code %j", (code) => {
    expect(mfaCodeSchema.safeParse({ factorId, code }).success).toBe(false);
  });

  it("rejects a factor id that is not a UUID", () => {
    expect(mfaCodeSchema.safeParse({ factorId: "x", code: "123456" }).success).toBe(false);
  });
});
