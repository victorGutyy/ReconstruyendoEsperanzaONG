import { describe, expect, it } from "vitest";

import { fitWithin } from "./prepare";
import { MAX_UPLOAD_BYTES, mediaPaths, rejectionMessage, requestUploadSchema } from "./schema";

describe("requestUploadSchema", () => {
  it("accepts the photo types the server can process", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(requestUploadSchema.safeParse({ type, size: 1000 }).success).toBe(true);
    }
  });

  it("rejects other types, empty and oversized files", () => {
    expect(requestUploadSchema.safeParse({ type: "image/svg+xml", size: 10 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ type: "image/heic", size: 10 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ type: "image/jpeg", size: 0 }).success).toBe(false);
    expect(
      requestUploadSchema.safeParse({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }).success,
    ).toBe(false);
  });
});

describe("mediaPaths", () => {
  it("only uses the media id as a name", () => {
    const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    expect(mediaPaths.incoming(id)).toBe(id);
    expect(mediaPaths.variant(id, "sm")).toBe(`${id}/sm.webp`);
  });
});

describe("fitWithin", () => {
  it("reduces the longest side to 2560 keeping proportions", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2560, height: 1920 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1920, height: 2560 });
  });

  it("never enlarges", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("rejectionMessage", () => {
  it("explains each rejection in Spanish", () => {
    expect(rejectionMessage("unsupported_type")).toContain("JPEG, PNG o WebP");
  });
});
