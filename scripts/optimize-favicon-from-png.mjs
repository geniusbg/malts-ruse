/**
 * Browser tab only: 16×16 and 32×32 from public/favicon.png.
 * PWA / Apple home-screen icons: npm run pwa-icons:optimize (from hero logo).
 *
 * Requires: public/favicon.png
 * Writes: favicon-16x16.png, favicon-32x32.png
 *
 * Run: npm run favicon:optimize
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC, 'favicon.png');

if (!fs.existsSync(SRC)) {
  console.error('Missing public/favicon.png — add your source PNG, then run again.');
  process.exit(1);
}

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
  { size: 16, outFile: 'favicon-16x16.png' },
  { size: 32, outFile: 'favicon-32x32.png' },
];

console.log(`Source: public/favicon.png (browser tab only)`);
for (const o of outputs) {
  // eslint-disable-next-line no-await-in-loop
  await writeIcon(o);
}
console.log(`Done: ${outputs.length} favicons → public/`);
