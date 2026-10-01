import { describe, expect, it } from "vitest";

import { labelFor, statusLabel, thisType } from "./registry";
import { parseSchedule } from "./schedule";

describe("parseSchedule", () => {
  const now = Date.parse("2026-10-01T15:00:00Z");

  it("reads a Colombian date and time (always UTC-5)", () => {
    expect(parseSchedule({ date: "2026-10-02", time: "08:30" }, now)).toEqual({
      ok: true,
      publishedAt: "2026-10-02T13:30:00.000Z",
    });
  });

  it("refuses the past, the next minute and malformed values", () => {
    expect(parseSchedule({ date: "2026-10-01", time: "09:00" }, now).ok).toBe(false);
    expect(parseSchedule({ date: "2026-10-01", time: "10:00" }, now).ok).toBe(false);
    expect(parseSchedule({ date: "2026-13-01", time: "08:00" }, now).ok).toBe(false);
    expect(parseSchedule({ date: "2026-10-02", time: "25:00" }, now).ok).toBe(false);
  });
});

describe("Spanish agreement", () => {
  it("says the state and the type with the right gender", () => {
    expect(labelFor("post", "published")).toBe("Publicada");
    expect(labelFor("project", "published")).toBe("Publicado");
    expect(statusLabel("project", "archived", null)).toBe("Archivado");
    expect(thisType("project")).toBe("Este proyecto");
    expect(thisType("activity")).toBe("Esta actividad");
  });
});
