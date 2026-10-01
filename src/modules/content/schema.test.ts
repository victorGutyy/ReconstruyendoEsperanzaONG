import { describe, expect, it } from "vitest";

import { optionalNoteSchema, reviewNoteSchema } from "./schema";

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
