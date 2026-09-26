import { describe, expect, it } from "vitest";

import { loginSchema, mfaCodeSchema, newPasswordSchema, recoverySchema } from "./schema";

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

describe("newPasswordSchema", () => {
  it("accepts a long passphrase that is confirmed", () => {
    const password = "tortuga lampara nube 47";
    expect(newPasswordSchema.safeParse({ password, confirm: password }).success).toBe(true);
  });

  it("requires at least 12 characters", () => {
    const result = newPasswordSchema.safeParse({ password: "corta123", confirm: "corta123" });
    expect(result.success).toBe(false);
  });

  it("requires both fields to match", () => {
    const result = newPasswordSchema.safeParse({
      password: "una-frase-bien-larga",
      confirm: "otra-frase-bien-larga",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Las dos contraseñas no coinciden.");
  });
});

describe("recoverySchema", () => {
  it("normalises the e-mail", () => {
    expect(recoverySchema.parse({ email: " Admin@Example.TEST" }).email).toBe("admin@example.test");
  });
});
