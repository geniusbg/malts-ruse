/**
 * PWA / Apple touch icons from the same asset as the homepage hero (malts-logo-hero.webp).
 * Fallback: public/malts-logo.png (run npm run logo:optimize first for .webp).
 *
 * Writes: apple-touch-icon.png, malts-icon-192.png, malts-icon-512.png, malts-icon-512-maskable.png
 *
 * Run: npm run pwa-icons:optimize
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const HERO_WEBP = path.join(PUBLIC, 'malts-logo-hero.webp');
const HERO_PNG = path.join(PUBLIC, 'malts-logo.png');

function resolveSource() {
  if (fs.existsSync(HERO_WEBP)) return HERO_WEBP;
  if (fs.existsSync(HERO_PNG)) return HERO_PNG;
  console.error('Missing malts-logo-hero.webp (or malts-logo.png). Run: npm run logo:optimize');
  process.exit(1);
}

const SRC = resolveSource();

/** @param {{ size: number; outFile: string }} o */
async function writeIcon(o) {
  const outPath = path.join(PUBLIC, o.outFile);
  const buf = await sharp(SRC)
    .resize(o.size, o.size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ${o.outFile}  ${o.size}×${o.size}  ${kb} KB`);
}

const outputs = [
  { size: 180, outFile: 'apple-touch-icon.png' },
  { size: 192, outFile: 'malts-icon-192.png' },
  { size: 512, outFile: 'malts-icon-512.png' },
  { size: 512, outFile: 'malts-icon-512-maskable.png' },
];

console.log(`Source: ${path.basename(SRC)}`);
for (const o of outputs) {
  // eslint-disable-next-line no-await-in-loop
  await writeIcon(o);
}
console.log(`Done: ${outputs.length} PWA / touch icons → public/`);
