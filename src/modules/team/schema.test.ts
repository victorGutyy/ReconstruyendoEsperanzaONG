import { describe, expect, it } from "vitest";

import { reviewTeamMember, teamSchema } from "./schema";

const base = { fullName: " [DEMO] Ana Pérez ", roleTitle: "Coordinadora", bio: "", consentId: "" };

describe("teamSchema", () => {
  it("allows a draft without authorization and keeps the bio as plain text", () => {
    expect(teamSchema.parse(base)).toEqual({
      full_name: "[DEMO] Ana Pérez",
      role_title: "Coordinadora",
      bio: null,
      consent_record_id: null,
    });
  });

  it("requires name and role and keeps the limits", () => {
    expect(teamSchema.safeParse({ ...base, fullName: " " }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, roleTitle: "" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, bio: "a".repeat(601) }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, consentId: "x" }).success).toBe(false);
  });
});

describe("reviewTeamMember", () => {
  it("needs a usable authorization to send or publish", () => {
    expect(reviewTeamMember({ consent: "missing", coverIssues: null }, false).canSubmit).toBe(
      false,
    );
    expect(reviewTeamMember({ consent: "gone", coverIssues: null }, true).items[0]?.text).toContain(
      "revocada o vencida",
    );
    expect(reviewTeamMember({ consent: "usable", coverIssues: null }, true).canPublish).toBe(true);
  });
});
