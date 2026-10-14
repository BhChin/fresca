// Copy each matched upscale to reference/upscaled/<original-number>.jpg.
//
//   node scripts/copy-upscales.mjs
//
// Reads reference/upscale-matches.json (written by scripts/match-upscales.py)
// and the candidate copies in reference/upscaled-raw/. Output is RGB JPEG at
// quality 90, long edge capped at 2400px (never enlarged), metadata stripped.
// The drawing/board images (21, 23, 24, 25) are never upscaled.
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(".");
const RAW = path.join(ROOT, "reference/upscaled-raw");
const OUT = path.join(ROOT, "reference/upscaled");
const BOARDS = new Set([21, 23, 24, 25]);
const LONG_EDGE = 2400;

const { candidates } = JSON.parse(await readFile(path.join(ROOT, "reference/upscale-matches.json"), "utf8"));
await mkdir(OUT, { recursive: true });

const seen = new Set();
for (const c of [...candidates].sort((a, b) => a.best - b.best)) {
  if (BOARDS.has(c.best)) continue;
  if (seen.has(c.best)) throw new Error(`two upscales matched to ${c.best}; resolve in match-upscales.py first`);
  seen.add(c.best);
  const info = await sharp(path.join(RAW, c.name))
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({ quality: 90 }) // sharp drops EXIF/ICC/XMP unless asked to keep them
    .toFile(path.join(OUT, `${c.best}.jpg`));
  console.log(`${String(c.best).padStart(2)}.jpg  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB  ← ${c.name}`);
}
