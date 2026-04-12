/**
 * One-off / repeatable: resize + compress public/malts-logo.png for the homepage hero.
 * Run: node scripts/optimize-malts-logo.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'malts-logo.png');
const outWebp = join(root, 'public', 'malts-logo-hero.webp');

const MAX = 1040; // ~2× max CSS width for crisp retina

const buf = await sharp(input)
  .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 86, effort: 6 })
  .toBuffer();
writeFileSync(outWebp, buf);

const outMeta = await sharp(buf).metadata();
const sizeKb = (buf.length / 1024).toFixed(1);
console.log(`Wrote ${outWebp}`);
console.log(`  ${outMeta.width}×${outMeta.height} WebP, ${sizeKb} KB`);
