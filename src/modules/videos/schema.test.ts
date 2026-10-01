import { describe, expect, it } from "vitest";

import { parseVideoFilters, videosHref } from "./list";
import { reviewVideo, videoSchema } from "./schema";

const ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

describe("videoSchema", () => {
  it("keeps only the provider and the id of the pasted link", () => {
    const parsed = videoSchema.parse({
      title: " [DEMO] Siembra ",
      description: "",
      url: "https://youtu.be/dQw4w9WgXcQ?si=tracking",
      owner: `project:${ID}`,
    });
    expect(parsed).toEqual({
      title: "[DEMO] Siembra",
      description: null,
      provider: "youtube",
      provider_video_id: "dQw4w9WgXcQ",
      activity_id: null,
      project_id: ID,
    });
    expect(JSON.stringify(parsed)).not.toContain("tracking");
  });

  it("explains what is wrong with the link", () => {
    const parsed = videoSchema.safeParse({
      title: "Video",
      description: "",
      url: "https://fb.watch/abc/",
      owner: "",
    });
    expect(parsed.error?.issues[0]?.message).toContain("enlace corto");
  });
});

describe("reviewVideo", () => {
  it("only warns without an image and blocks a pending one for editors", () => {
    expect(reviewVideo(null, true).canPublish).toBe(true);
    expect(reviewVideo(["missing_consent"], false).canSubmit).toBe(true);
    expect(reviewVideo(["missing_consent"], true).canPublish).toBe(false);
  });
});

describe("video filters", () => {
  it("filters by platform", () => {
    const filters = parseVideoFilters({ provider: "vimeo", status: "x" });
    expect(filters).toMatchObject({ provider: "vimeo", status: undefined });
    expect(videosHref(filters)).toBe("/admin/contenido/videos?provider=vimeo");
  });
});
