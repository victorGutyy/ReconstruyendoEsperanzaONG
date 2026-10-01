import { describe, expect, it } from "vitest";

import { galleriesHref, parseGalleryFilters } from "./list";
import { gallerySchema, ownerValue, reviewGallery } from "./schema";

const ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

describe("gallerySchema", () => {
  it("turns the owner into an activity or a project", () => {
    expect(
      gallerySchema.parse({ title: " [DEMO] Siembra ", description: "", owner: `activity:${ID}` }),
    ).toEqual({ title: "[DEMO] Siembra", description: null, activity_id: ID, project_id: null });
    expect(
      gallerySchema.parse({ title: "Huertas", description: "Fotos", owner: `project:${ID}` }),
    ).toMatchObject({ activity_id: null, project_id: ID });
    expect(gallerySchema.parse({ title: "Sola", description: "", owner: "" })).toMatchObject({
      activity_id: null,
      project_id: null,
    });
  });

  it("refuses an owner that is not an activity or a project", () => {
    expect(
      gallerySchema.safeParse({ title: "x", description: "", owner: `post:${ID}` }).success,
    ).toBe(false);
    expect(
      gallerySchema.safeParse({ title: "x", description: "", owner: "activity:1" }).success,
    ).toBe(false);
  });

  it("writes the owner back for the form", () => {
    expect(ownerValue(ID, null)).toBe(`activity:${ID}`);
    expect(ownerValue(null, ID)).toBe(`project:${ID}`);
    expect(ownerValue(null, null)).toBe("");
  });
});

describe("reviewGallery", () => {
  const ready = { label: "Foto 1", processing: false, issues: [] };

  it("needs at least one photo", () => {
    expect(reviewGallery([], true).canPublish).toBe(false);
    expect(reviewGallery([ready, ready], true).items.at(-1)?.text).toBe(
      "Las 2 fotos están listas para publicarse.",
    );
  });

  it("lets an author send photos missing an authorization, not an editor publish them", () => {
    const pending = [ready, { label: "Foto 2", processing: false, issues: ["missing_consent"] }];
    expect(reviewGallery(pending, false).canSubmit).toBe(true);
    expect(reviewGallery(pending, true).canPublish).toBe(false);
  });

  it("stops everyone while a photo is still uploading", () => {
    const uploading = [{ label: "Foto 1", processing: true, issues: [] }];
    expect(reviewGallery(uploading, false).canSubmit).toBe(false);
  });
});

describe("gallery filters", () => {
  it("reads the URL and builds it back", () => {
    const filters = parseGalleryFilters({ status: "review", q: " huerta " });
    expect(galleriesHref(filters, { mine: true })).toBe(
      "/admin/contenido/galerias?status=review&q=huerta&mine=1",
    );
  });
});
