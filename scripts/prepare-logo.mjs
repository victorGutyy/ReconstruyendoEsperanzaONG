// Prepares the logo for the site (step 8.x, logo): crops it, makes the paper
// background transparent and writes the sizes the site uses into public/brand.
// The original stays outside the repository (client files, CLAUDE.md):
//
//   node scripts/prepare-logo.mjs "<path to the original JPG>"
//
// Run it again with a better original (SVG/PNG export) and nothing else changes.

import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/prepare-logo.mjs "<original logo file>"');
  process.exit(1);
}

const OUT = path.join(process.cwd(), "public", "brand");
// Colour distance from the paper: below LOW it is paper, above HIGH it is ink
const LOW = 22;
const HIGH = 70;
// Luminance under which a pixel of the icon belongs to the oval's dark green line
const DARK_LINE = 85;

// Scans and exports often carry a thin line at the edges: drop a margin first
const EDGE = 12;
const original = await sharp(source).metadata();
const { data, info } = await sharp(source)
  .extract({
    left: EDGE,
    top: EDGE,
    width: original.width - 2 * EDGE,
    height: original.height - 2 * EDGE,
  })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;

// The paper's colour: the median of the border pixels
const border = [];
for (let x = 0; x < width; x += 4) border.push(x, (height - 1) * width + x);
for (let y = 0; y < height; y += 4) border.push(y * width, y * width + width - 1);
const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];
const paper = [0, 1, 2].map((c) => median(border.map((p) => data[p * 3 + c])));

// Alpha from the distance to the paper, colour un-mixed from it so soft
// edges keep their real green and gold over any background
const rgba = Buffer.alloc(width * height * 4);
for (let p = 0; p < width * height; p += 1) {
  const r = data[p * 3];
  const g = data[p * 3 + 1];
  const b = data[p * 3 + 2];
  const lighter = (r + g + b) / 3 > (paper[0] + paper[1] + paper[2]) / 3;
  const distance = Math.max(Math.abs(r - paper[0]), Math.abs(g - paper[1]), Math.abs(b - paper[2]));
  // Paper texture can be a bit lighter than its median: still paper
  const alpha =
    lighter && distance < HIGH ? 0 : Math.min(1, Math.max(0, (distance - LOW) / (HIGH - LOW)));
  const unmix = (value, base) =>
    alpha > 0 ? Math.round(Math.min(255, Math.max(0, base + (value - base) / alpha))) : 0;
  rgba[p * 4] = unmix(r, paper[0]);
  rgba[p * 4 + 1] = unmix(g, paper[1]);
  rgba[p * 4 + 2] = unmix(b, paper[2]);
  rgba[p * 4 + 3] = Math.round(alpha * 255);
}

await mkdir(OUT, { recursive: true });
const transparent = sharp(rgba, { raw: { width, height, channels: 4 } }).trim();
const logo = await transparent.png().toBuffer();
const { width: logoWidth, height: logoHeight } = await sharp(logo).metadata();

// Header: 2× for sharp screens at its largest (≈ 420 px wide on desktop)
for (const [name, target] of [
  ["logo-840", 840],
  ["logo-420", 420],
]) {
  const resized = sharp(logo).resize({ width: Math.min(target, logoWidth) });
  // WebP only: every current browser reads it (docs/07 §10 weight budget)
  await resized
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(path.join(OUT, `${name}.webp`));
}

// The leaves alone, for the tab icon: the right end of the logo, without the
// pieces of the oval's line that cross it (thin and long, unlike a leaf)
const corner = await sharp(logo)
  .extract({
    left: Math.round(logoWidth * 0.8),
    top: 0,
    width: Math.round(logoWidth * 0.19),
    height: Math.round(logoHeight * 0.55),
  })
  .raw()
  .toBuffer({ resolveWithObject: true });
const leaves = await sharp(keepSolidShapes(corner.data, corner.info), {
  raw: { width: corner.info.width, height: corner.info.height, channels: 4 },
})
  .trim()
  .png()
  .toBuffer();
for (const size of [32, 180, 512]) {
  await sharp(leaves)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ palette: true, compressionLevel: 9 })
    .toFile(path.join(OUT, `icon-${size}.png`));
}

console.log(`Paper ${paper.join(",")} · logo ${logoWidth}×${logoHeight} → ${OUT}`);

/** Clears the dark line and every shape that fills less than a quarter of its box. */
function keepSolidShapes(pixels, { width, height }) {
  const out = Buffer.from(pixels);
  const seen = new Uint8Array(width * height);
  // The oval's line is a much darker green than the leaves
  const luminance = (p) =>
    0.3 * pixels[p * 4] + 0.59 * pixels[p * 4 + 1] + 0.11 * pixels[p * 4 + 2];
  const visible = (p) => pixels[p * 4 + 3] > 64 && luminance(p) >= DARK_LINE;
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !visible(start)) continue;
    const shape = [];
    const stack = [start];
    seen[start] = 1;
    let [minX, maxX, minY, maxY] = [width, 0, height, 0];
    while (stack.length > 0) {
      const p = stack.pop();
      shape.push(p);
      const x = p % width;
      const y = (p / width) | 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (!seen[q] && visible(q)) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    const fill = shape.length / ((maxX - minX + 1) * (maxY - minY + 1));
    if (fill < 0.25 || shape.length < 200) for (const p of shape) out[p * 4 + 3] = 0;
  }
  // Faint pixels and the dark line itself
  for (let p = 0; p < width * height; p += 1) if (!visible(p)) out[p * 4 + 3] = 0;
  return out;
}
