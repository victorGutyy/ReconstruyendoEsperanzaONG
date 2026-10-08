import { describe, expect, it } from "vitest";

import { embedUrl, parseVideoUrl, watchUrl } from "./parse";

const YT = "dQw4w9WgXcQ";

describe("parseVideoUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${YT}`, "youtube", YT],
    [`https://youtube.com/watch?v=${YT}&t=42s&list=PL1`, "youtube", YT],
    [`https://m.youtube.com/watch?v=${YT}`, "youtube", YT],
    [`https://youtu.be/${YT}?si=abc`, "youtube", YT],
    [`https://www.youtube.com/shorts/${YT}`, "youtube", YT],
    [`https://www.youtube.com/live/${YT}`, "youtube", YT],
    [`www.youtube.com/watch?v=${YT}`, "youtube", YT],
    ["https://vimeo.com/76979871", "vimeo", "76979871"],
    ["https://player.vimeo.com/video/76979871", "vimeo", "76979871"],
    ["https://vimeo.com/channels/staffpicks/76979871", "vimeo", "76979871"],
    ["https://www.facebook.com/ONG/videos/1234567890123456/", "facebook", "1234567890123456"],
    ["https://www.facebook.com/watch/?v=1234567890123456", "facebook", "1234567890123456"],
    ["https://m.facebook.com/reel/1234567890", "facebook", "1234567890"],
    [
      "https://www.tiktok.com/@ong.calarca/video/7212345678901234567",
      "tiktok",
      "7212345678901234567",
    ],
  ])("reads %s", (url, provider, id) => {
    expect(parseVideoUrl(url)).toEqual({ ok: true, provider, id });
  });

  it("refuses short links instead of following them", () => {
    for (const url of ["https://fb.watch/abc123/", "https://vm.tiktok.com/ZMabc/"]) {
      const parsed = parseVideoUrl(url);
      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && parsed.error).toContain("enlace corto");
    }
  });

  it("refuses other sites, look-alike hosts and odd URLs", () => {
    for (const url of [
      "https://dailymotion.com/video/x8abc",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://evil.example/?u=https://youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
      "",
      `https://www.youtube.com/watch?v=${"a".repeat(600)}`,
    ]) {
      expect(parseVideoUrl(url).ok).toBe(false);
    }
  });

  it("refuses pages that are not a video and unlisted Vimeo videos", () => {
    expect(parseVideoUrl("https://www.youtube.com/@canal").ok).toBe(false);
    expect(parseVideoUrl("https://www.youtube.com/watch?v=<script>").ok).toBe(false);
    expect(parseVideoUrl("https://www.facebook.com/ONG").ok).toBe(false);
    expect(parseVideoUrl("https://www.tiktok.com/@ong").ok).toBe(false);
    const hidden = parseVideoUrl("https://vimeo.com/76979871/abcdef1234");
    expect(!hidden.ok && hidden.error).toContain("ocultos");
  });
});

describe("watchUrl", () => {
  it("gives back links that are read again the same way (editing a saved video)", () => {
    for (const [provider, id] of [
      ["youtube", YT],
      ["vimeo", "76979871"],
      ["facebook", "1234567890"],
      ["tiktok", "7212345678901234567"],
    ] as const) {
      expect(parseVideoUrl(watchUrl(provider, id))).toEqual({ ok: true, provider, id });
    }
  });

  it("builds the provider's own address from the id", () => {
    expect(watchUrl("youtube", YT)).toBe(`https://www.youtube.com/watch?v=${YT}`);
    expect(watchUrl("vimeo", "76979871")).toBe("https://vimeo.com/76979871");
    expect(watchUrl("facebook", "123")).toBe("https://www.facebook.com/watch/?v=123");
    expect(watchUrl("tiktok", "721")).toBe("https://www.tiktok.com/embed/v2/721");
  });
});

describe("embedUrl", () => {
  it("builds privacy-friendly players from a validated id only", () => {
    expect(embedUrl("youtube", "dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(embedUrl("vimeo", "76979871")).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(embedUrl("tiktok", "7123456789012345678")).toBe(
      "https://www.tiktok.com/embed/v2/7123456789012345678",
    );
  });

  it("never embeds Facebook nor an odd id", () => {
    expect(embedUrl("facebook", "123456")).toBeNull();
    expect(embedUrl("youtube", 'abc"><script>')).toBeNull();
    expect(embedUrl("vimeo", "12ab")).toBeNull();
    expect(embedUrl("tiktok", "../../x")).toBeNull();
  });
});
