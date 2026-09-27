import { describe, expect, it } from "vitest";

import { changeRoleSchema, inviteSchema, setActiveSchema } from "./schema";

const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("inviteSchema", () => {
  it("normalises the e-mail and trims the name", () => {
    const parsed = inviteSchema.parse({
      email: " Nueva@Example.TEST ",
      fullName: "  [DEMO] Nueva Persona ",
      role: "editor",
    });
    expect(parsed).toEqual({
      email: "nueva@example.test",
      fullName: "[DEMO] Nueva Persona",
      role: "editor",
    });
  });

  it("rejects unknown roles", () => {
    expect(
      inviteSchema.safeParse({ email: "a@example.test", fullName: "x", role: "owner" }).success,
    ).toBe(false);
  });

  it("requires a name", () => {
    expect(
      inviteSchema.safeParse({ email: "a@example.test", fullName: "  ", role: "author" }).success,
    ).toBe(false);
  });
});

describe("changeRoleSchema", () => {
  it("accepts a valid change", () => {
    expect(changeRoleSchema.safeParse({ userId, role: "admin" }).success).toBe(true);
  });

  it("rejects a user id that is not a UUID", () => {
    expect(changeRoleSchema.safeParse({ userId: "1", role: "admin" }).success).toBe(false);
  });
});

describe("setActiveSchema", () => {
  it("turns the form value into a boolean", () => {
    expect(setActiveSchema.parse({ userId, active: "false" }).active).toBe(false);
    expect(setActiveSchema.parse({ userId, active: "true" }).active).toBe(true);
  });

  it("rejects anything else", () => {
    expect(setActiveSchema.safeParse({ userId, active: "yes" }).success).toBe(false);
  });
});
