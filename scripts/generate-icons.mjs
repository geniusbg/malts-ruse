import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

/** Same hero as admin login; then legacy SVGs */
const SRC_HERO = path.join(PUBLIC_DIR, 'malts-logo-hero.webp');
const SRC_ICON = path.join(PUBLIC_DIR, 'malts-icon.svg');
const SRC_LOGO = path.join(PUBLIC_DIR, 'malts.svg');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRasterSource(filePath) {
  return /\.(webp|png|jpe?g|gif|avif)$/i.test(filePath);
}

/** Prefer login hero; fallback to mark SVG, then full SVG logo. */
async function resolveSourceImage() {
  if (await exists(SRC_HERO)) return SRC_HERO;
  if (await exists(SRC_ICON)) return SRC_ICON;
  if (await exists(SRC_LOGO)) return SRC_LOGO;
  throw new Error(`No source image found. Expected ${SRC_HERO}, ${SRC_ICON} or ${SRC_LOGO}`);
}

async function ensurePublic() {
  const ok = await exists(PUBLIC_DIR);
  if (!ok) throw new Error(`public/ not found at ${PUBLIC_DIR}`);
}

/**
 * PNG with opaque white background (favicon / PWA tiles on dark browser chrome).
 */
async function writePng({ size, outFile, sourcePath }) {
  const outPath = path.join(PUBLIC_DIR, outFile);
  const sharpIn = isRasterSource(sourcePath)
    ? sharp(sourcePath)
    : sharp(sourcePath, { density: 512 });
  const buf = await sharpIn
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await fs.writeFile(outPath, buf);
  return outPath;
}

async function main() {
  await ensurePublic();
  const sourcePath = await resolveSourceImage();

  const outputs = [
    { size: 16, outFile: 'favicon-16x16.png' },
    { size: 32, outFile: 'favicon-32x32.png' },
    { size: 180, outFile: 'apple-touch-icon.png' },
    { size: 192, outFile: 'malts-icon-192.png' },
    { size: 512, outFile: 'malts-icon-512.png' },
    { size: 512, outFile: 'malts-icon-512-maskable.png' },
  ];

  const written = [];
  for (const o of outputs) {
    // eslint-disable-next-line no-await-in-loop
    written.push(await writePng({ ...o, sourcePath }));
  }

  // eslint-disable-next-line no-console
  console.log(`Generated ${written.length} icons from ${path.basename(sourcePath)} (white background)`);
}

await main();
