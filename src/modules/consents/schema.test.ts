import { describe, expect, it } from "vitest";

import {
  consentStatus,
  escapeLike,
  parseConsentFilters,
  readConsentFields,
  revokeSchema,
  todayInBogota,
} from "./schema";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const adult = {
  subjectName: " [DEMO] Ana ",
  signerType: "self",
  signerName: "",
  scopeDescription: "Fotos de la jornada del 12/03/2026",
  grantedOn: "2026-03-12",
  validUntil: "",
  channel: "paper",
  formVersion: "v1",
};

describe("readConsentFields", () => {
  it("maps an adult authorization to database columns", () => {
    const parsed = readConsentFields(form(adult));
    expect(parsed.success && parsed.data).toEqual({
      subject_name: "[DEMO] Ana",
      is_minor: false,
      minor_opinion: null,
      signer_type: "self",
      signer_name: null,
      scope_description: "Fotos de la jornada del 12/03/2026",
      granted_on: "2026-03-12",
      valid_until: null,
      channel: "paper",
      form_version: "v1",
    });
  });

  it("requires the legal guardian and the minor's opinion for a minor", () => {
    const parsed = readConsentFields(form({ ...adult, isMinor: "on" }));
    expect(parsed.success).toBe(false);
    const messages = parsed.error!.issues.map((issue) => issue.message);
    expect(messages).toContain("Si es menor de edad, firma su representante legal.");
    expect(messages).toContain(
      "Registra la opinión del menor (o indica que no aplica por su edad).",
    );
  });

  it("requires the name of the legal guardian", () => {
    const parsed = readConsentFields(
      form({ ...adult, isMinor: "on", signerType: "legal_guardian", minorOpinion: "agrees" }),
    );
    expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([
      "Escribe el nombre del representante legal.",
    ]);
  });

  it("accepts a complete minor authorization", () => {
    const parsed = readConsentFields(
      form({
        ...adult,
        isMinor: "on",
        signerType: "legal_guardian",
        signerName: "[DEMO] Madre",
        minorOpinion: "agrees",
      }),
    );
    expect(parsed.success && parsed.data).toMatchObject({
      is_minor: true,
      minor_opinion: "agrees",
      signer_name: "[DEMO] Madre",
    });
  });

  it("drops a leftover minor opinion for an adult", () => {
    const parsed = readConsentFields(form({ ...adult, minorOpinion: "agrees" }));
    expect(parsed.success && parsed.data.minor_opinion).toBeNull();
  });

  it("rejects future signatures and end dates before the signature", () => {
    expect(readConsentFields(form({ ...adult, grantedOn: "2999-01-01" })).success).toBe(false);
    expect(readConsentFields(form({ ...adult, validUntil: "2026-01-01" })).success).toBe(false);
  });
});

describe("consentStatus", () => {
  const base = { revokedAt: null, validUntil: null, isMinor: false, minorOpinion: null };
  it("follows the same rule as the database", () => {
    expect(consentStatus(base, "2026-09-28")).toBe("active");
    expect(consentStatus({ ...base, revokedAt: "2026-09-01T00:00:00Z" }, "2026-09-28")).toBe(
      "revoked",
    );
    expect(consentStatus({ ...base, validUntil: "2026-09-27" }, "2026-09-28")).toBe("expired");
    expect(consentStatus({ ...base, validUntil: "2026-09-28" }, "2026-09-28")).toBe("active");
    expect(consentStatus({ ...base, isMinor: true, minorOpinion: "disagrees" }, "2026-09-28")).toBe(
      "not_authorizing",
    );
  });
});

describe("todayInBogota", () => {
  it("uses Colombian time (UTC-5)", () => {
    expect(todayInBogota(new Date("2026-09-29T03:00:00Z"))).toBe("2026-09-28");
    expect(todayInBogota(new Date("2026-09-29T06:00:00Z"))).toBe("2026-09-29");
  });
});

describe("filters and search", () => {
  it("reads the URL and ignores invalid values", () => {
    expect(parseConsentFilters({ q: " Ana ", minors: "1", status: "revoked" })).toEqual({
      q: "Ana",
      minors: true,
      status: "revoked",
      page: 1,
    });
    expect(parseConsentFilters({ status: "deleted", page: "x" })).toMatchObject({
      status: "active",
      page: 1,
    });
  });

  it("searches % and _ literally", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("revokeSchema", () => {
  it("requires a short explanation", () => {
    const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    expect(revokeSchema.safeParse({ id, note: "no" }).success).toBe(false);
    expect(revokeSchema.safeParse({ id, note: "La madre lo pidió por WhatsApp" }).success).toBe(
      true,
    );
  });
});
