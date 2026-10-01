import { describe, expect, it } from "vitest";

import {
  basicsSchema,
  displayStatus,
  fromBogotaInstant,
  optionalNoteSchema,
  parseStep,
  reviewNoteSchema,
  toBogotaInstant,
} from "./schema";

const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Sembramos 50 árboles." }] }],
};

const basics = {
  title: "  [DEMO] Jornada de siembra ",
  date: "2026-09-20",
  startTime: "09:30",
  endTime: "",
  placeId: "",
  categoryId: "",
  summary: "",
  body,
};

describe("Bogotá dates", () => {
  it("converts a local date and time to an instant and back", () => {
    const iso = toBogotaInstant("2026-09-20", "09:30");
    expect(iso).toBe("2026-09-20T14:30:00.000Z");
    expect(fromBogotaInstant(iso)).toEqual({ date: "2026-09-20", time: "09:30" });
  });

  it("keeps the local day late at night", () => {
    expect(fromBogotaInstant(toBogotaInstant("2026-12-31", "23:45"))).toEqual({
      date: "2026-12-31",
      time: "23:45",
    });
  });
});

describe("basicsSchema", () => {
  it("maps step 1 to database columns, allowing a draft without place or category", () => {
    const parsed = basicsSchema.parse(basics);
    expect(parsed).toMatchObject({
      title: "[DEMO] Jornada de siembra",
      starts_at: "2026-09-20T14:30:00.000Z",
      ends_at: null,
      place_id: null,
      category_id: null,
      summary: null,
      body_text: "Sembramos 50 árboles.",
    });
    expect(parsed.body).toEqual(body);
  });

  it("stores an empty story as null", () => {
    const parsed = basicsSchema.parse({
      ...basics,
      body: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(parsed.body).toBeNull();
    expect(parsed.body_text).toBeNull();
  });

  it("rejects a missing title, an end before the start and a story with forbidden formatting", () => {
    expect(basicsSchema.safeParse({ ...basics, title: " " }).success).toBe(false);
    expect(basicsSchema.safeParse({ ...basics, endTime: "08:00" }).success).toBe(false);
    const bad = basicsSchema.safeParse({
      ...basics,
      body: { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toMatch(/formato no permitido/);
  });
});

describe("wizard helpers", () => {
  it("reads the step from the URL", () => {
    expect(parseStep("2")).toBe(2);
    expect(parseStep(["4"])).toBe(4);
    expect(parseStep("9")).toBe(1);
    expect(parseStep(undefined)).toBe(1);
  });

  it("shows published content with a future date as scheduled", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(displayStatus("published", "2026-10-01T12:00:00Z", now)).toBe("scheduled");
    expect(displayStatus("published", "2026-09-01T12:00:00Z", now)).toBe("published");
    expect(displayStatus("review", null, now)).toBe("review");
  });
});

describe("review notes", () => {
  it("requires a note to return an activity, trimmed and up to 1000 characters", () => {
    expect(reviewNoteSchema.safeParse("  Falta la portada. ").data).toBe("Falta la portada.");
    expect(reviewNoteSchema.safeParse("   ").success).toBe(false);
    expect(reviewNoteSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });

  it("treats a blank note as no note when retiring", () => {
    expect(optionalNoteSchema.safeParse("  ").data).toBeUndefined();
    expect(optionalNoteSchema.safeParse("Corregir la fecha").data).toBe("Corregir la fecha");
    expect(optionalNoteSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});
