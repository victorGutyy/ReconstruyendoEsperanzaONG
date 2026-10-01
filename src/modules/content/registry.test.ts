import { describe, expect, it } from "vitest";

import {
  AVAILABLE_CHANGES,
  CONTENT_TYPES,
  displayStatus,
  isContentType,
  STATUS_CHANGES,
} from "./registry";

describe("content registry", () => {
  it("knows activities and stories, nothing else", () => {
    expect(isContentType("activity")).toBe(true);
    expect(isContentType("post")).toBe(true);
    expect(isContentType("toString")).toBe(false);
    expect(isContentType(undefined)).toBe(false);
    expect(CONTENT_TYPES.post.editPath("x")).toBe("/admin/contenido/historias/x");
  });

  it("offers only the changes the database allows from each state", () => {
    for (const [status, changes] of Object.entries(AVAILABLE_CHANGES)) {
      for (const change of changes) expect(STATUS_CHANGES[change].from).toBe(status);
    }
    expect(AVAILABLE_CHANGES.draft).toEqual([]);
  });

  it("shows a published item with a future date as scheduled", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    expect(displayStatus("published", "2026-10-01T12:00:00Z", now)).toBe("scheduled");
    expect(displayStatus("published", "2026-09-01T12:00:00Z", now)).toBe("published");
    expect(displayStatus("review", null, now)).toBe("review");
  });
});
