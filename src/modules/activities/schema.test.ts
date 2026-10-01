import { describe, expect, it } from "vitest";

import { basicsSchema, fromBogotaInstant, parseStep, toBogotaInstant } from "./schema";

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
});
