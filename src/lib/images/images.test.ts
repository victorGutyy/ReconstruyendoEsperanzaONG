// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { ImageRejectedError, MEDIA_WIDTHS, processImage } from "./process";
import { detectImageType } from "./signature";

/** A phone-like photo: EXIF with GPS coordinates and a rotation flag. */
async function photoWithGps(width: number, height: number, orientation = 1) {
  return sharp({ create: { width, height, channels: 3, background: "#7a9a60" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "DemoPhone", Model: "[DEMO]" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "4/1 31/1 0/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "75/1 41/1 0/1",
      },
    })
    .withMetadata({ orientation })
    .toBuffer();
}

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", async () => {
    const image = sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } });
    expect(detectImageType(await image.clone().jpeg().toBuffer())).toBe("image/jpeg");
    expect(detectImageType(await image.clone().png().toBuffer())).toBe("image/png");
    expect(detectImageType(await image.clone().webp().toBuffer())).toBe("image/webp");
  });

  it("rejects SVG, text and other files whatever their name says", () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(Buffer.from("not an image"))).toBeNull();
    expect(detectImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("processImage", () => {
  it("removes EXIF and GPS and writes three WebP sizes", async () => {
    const original = await photoWithGps(2400, 1600);
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const variants = await processImage(original);
    expect(variants.map((variant) => [variant.size, variant.width])).toEqual([
      ["sm", MEDIA_WIDTHS.sm],
      ["md", MEDIA_WIDTHS.md],
      ["lg", MEDIA_WIDTHS.lg],
    ]);

    for (const variant of variants) {
      const metadata = await sharp(variant.data).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(variant.data.includes(Buffer.from("DemoPhone"))).toBe(false);
      expect(variant.bytes).toBe(variant.data.byteLength);
    }
  });

  it("applies the phone's rotation before removing it", async () => {
    // Stored landscape, but the camera says "rotate 90°" (orientation 6)
    const variants = await processImage(await photoWithGps(300, 200, 6));
    const small = variants.find((variant) => variant.size === "sm")!;
    expect([small.width, small.height]).toEqual([200, 300]);
  });

  it("never enlarges a small photo", async () => {
    const variants = await processImage(await photoWithGps(320, 240));
    expect(variants.every((variant) => variant.width === 320)).toBe(true);
  });

  it("accepts custom sizes (e.g. one version for signed forms)", async () => {
    const variants = await processImage(await photoWithGps(2000, 1000), { widths: { form: 1600 } });
    expect(variants.map((variant) => [variant.size, variant.width])).toEqual([["form", 1600]]);
  });

  it("rejects files that are not images, too big or with too many pixels", async () => {
    await expect(processImage(Buffer.from("<svg></svg>"))).rejects.toMatchObject({
      reason: "unsupported_type",
    });
    await expect(processImage(Buffer.alloc(16 * 1024 * 1024))).rejects.toMatchObject({
      reason: "too_large",
    });
    await expect(
      processImage(await photoWithGps(1000, 1000), { widths: { sm: 480 }, maxPixels: 500_000 }),
    ).rejects.toMatchObject({ reason: "too_many_pixels" });
  });

  it("rejects a truncated file with an image signature", async () => {
    const truncated = (await photoWithGps(800, 600)).subarray(0, 200);
    await expect(processImage(truncated)).rejects.toBeInstanceOf(ImageRejectedError);
  });
});
