// One-off: copy the photos the design uses from the client folder into
// public/images/ with descriptive names, flattened to RGB JPEG.
//
//   node scripts/prepare-images.mjs ["/path/to/FRESCA PHOTOS"]
//
// Never resizes, so files are only ever as large as the originals. When the
// client sends higher-res photos, re-run this (or drop files with the same
// names into public/images/) and nothing else needs to change.
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] ?? path.join(homedir(), "Downloads", "FRESCA PHOTOS");
const OUT = path.resolve("public/images");

// Keep in sync with the IMAGE MAP comment in content/site.ts.
const MAP = {
  1: "black-hood-kitchen",
  2: "black-hood-kitchen-island",
  3: "navy-chair-great-room",
  4: "bay-window-dining",
  5: "walnut-island-kitchen",
  6: "orb-chandelier-dining",
  7: "blue-gray-island-kitchen",
  9: "gloss-kitchen",
  21: "kitchen-material-board",
  23: "color-floor-plan",
  24: "lighting-fixture-sheet",
  25: "lighting-ceiling-plan",
  26: "freestanding-tub-bath",
  29: "black-hex-shower",
  31: "navy-double-vanity",
  32: "hammered-sink-bath",
  34: "walnut-guest-bath",
  37: "blush-guest-bedroom",
  38: "reclaimed-wood-bedroom",
  39: "bay-window-sitting-room",
  40: "iron-bed-bedroom",
  41: "mosaic-fireplace-family-room",
  42: "cognac-living-room",
  43: "two-story-living-room",
  44: "sectional-living-room",
};

// Design-board screenshots whose top/bottom bands are fully transparent and
// would render as black bars once flattened. Crop them to the opaque area.
const TRIM_TRANSPARENT = new Set([23, 24]);

async function opaqueBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

await mkdir(OUT, { recursive: true });

for (const [n, name] of Object.entries(MAP)) {
  const file = path.join(SRC, `${n}.png`);
  let img = sharp(file);
  if (TRIM_TRANSPARENT.has(Number(n))) img = img.extract(await opaqueBox(file));
  const out = path.join(OUT, `${name}.jpg`);
  const info = await img
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(out);
  console.log(`${n}.png → images/${name}.jpg  ${info.width}×${info.height}`);
}

// Open Graph card: the hero kitchen cropped to ~1.91:1 (no upscaling).
const og = await sharp(path.join(SRC, "1.png")).metadata();
const ogH = Math.round(og.width / 1.91);
await sharp(path.join(SRC, "1.png"))
  .extract({ left: 0, top: Math.round((og.height - ogH) / 2), width: og.width, height: ogH })
  .flatten({ background: "#ffffff" })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(path.join(OUT, "og-image.jpg"));
console.log(`og-image.jpg  ${og.width}×${ogH}`);
