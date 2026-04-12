/**
 * Nav bar: resize + WebP from public/malts-logo-small.png (keeps file small for every page load).
 * Run: node scripts/optimize-malts-logo-nav.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'malts-logo-small.png');
const outWebp = join(root, 'public', 'malts-logo-nav.webp');

/** Fits in the nav row (~80px CSS height @2× retina ≈ 160px; cap width for KBs) */
const MAX = 400;

const buf = await sharp(input)
  .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 86, effort: 6 })
  .toBuffer();

writeFileSync(outWebp, buf);

const outMeta = await sharp(buf).metadata();
const sizeKb = (buf.length / 1024).toFixed(1);
console.log(`Wrote ${outWebp}`);
console.log(`  ${outMeta.width}×${outMeta.height} WebP, ${sizeKb} KB`);
