import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { stalledUploadsFilter } = await import("./cleanup");

describe("stalledUploadsFilter", () => {
  it("gives a stalled upload a day and a failed one a week (step 9.3)", () => {
    expect(stalledUploadsFilter(new Date("2026-10-12T12:00:00.000Z"))).toBe(
      "and(processing_status.eq.processing,created_at.lt.2026-10-11T12:00:00.000Z)," +
        "and(processing_status.eq.failed,created_at.lt.2026-10-05T12:00:00.000Z)",
    );
  });
});
