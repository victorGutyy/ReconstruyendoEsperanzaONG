import { describe, expect, it } from "vitest";

import { reviewActivity } from "./review";

const place = "11111111-0000-0000-0000-000000000001";
const category = "22222222-0000-0000-0000-000000000001";

const photo = (n: number, issues: string[] = [], processing = false) => ({
  mediaId: `m${n}`,
  label: `Foto ${n}`,
  processing,
  issues,
});

describe("reviewActivity", () => {
  it("is all green when the data is complete and the photos can be published", () => {
    const review = reviewActivity(
      { placeId: place, categoryId: category, photos: [photo(1)] },
      true,
    );
    expect(review.items.map((item) => item.level)).toEqual(["ok", "ok"]);
    expect(review).toMatchObject({ canSubmit: true, canPublish: true });
  });

  it("blocks everyone when basic data is missing, pointing to step 1", () => {
    for (const publisher of [true, false]) {
      const review = reviewActivity({ placeId: null, categoryId: null, photos: [] }, publisher);
      expect(
        review.items.filter((item) => item.level === "error").map((item) => item.step),
      ).toEqual([1, 1]);
      expect(review.canSubmit).toBe(false);
      expect(review.canPublish).toBe(false);
    }
  });

  it("lets an author send to review with warnings about photos", () => {
    const review = reviewActivity(
      {
        placeId: place,
        categoryId: category,
        photos: [photo(1, ["missing_alt_text"]), photo(2, ["missing_guardian_consent"])],
      },
      false,
    );
    expect(review.items.filter((item) => item.level === "warn")).toEqual([
      { key: "missing_alt_text:m1", level: "warn", text: "Foto 1: falta la descripción.", step: 2 },
      {
        key: "missing_guardian_consent:m2",
        level: "warn",
        text: "Foto 2: hay menores y falta la autorización de su representante.",
        step: 3,
      },
    ]);
    expect(review.canSubmit).toBe(true);
    expect(review.canPublish).toBe(false);
  });

  it("does not let an editor publish while a photo lacks its authorization", () => {
    const review = reviewActivity(
      { placeId: place, categoryId: category, photos: [photo(1, ["missing_consent"])] },
      true,
    );
    expect(review.items.find((item) => item.key === "missing_consent:m1")?.level).toBe("error");
    expect(review.canPublish).toBe(false);
  });

  it("blocks everyone while a photo has not finished uploading", () => {
    const review = reviewActivity(
      { placeId: place, categoryId: category, photos: [photo(1, [], true)] },
      false,
    );
    expect(review.canSubmit).toBe(false);
    expect(review.items[1]).toMatchObject({ level: "error", step: 2 });
  });

  it("warns, without blocking, when there are no photos", () => {
    const review = reviewActivity({ placeId: place, categoryId: category, photos: [] }, true);
    expect(review.items.find((item) => item.key === "no-photos")?.level).toBe("warn");
    expect(review.canPublish).toBe(true);
  });
});
