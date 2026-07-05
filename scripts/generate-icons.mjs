// Generates simple brand PNG icons into public/icons/ (no external deps).
// Run: node scripts/generate-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Draw a filled circle "dumbbell" glyph feel via two rectangles on a gradient bg.
function makePng(size) {
  const bg1 = [0x0b, 0x0f, 0x17]; // dark
  const accent = [0x4f, 0x8c, 0xff]; // blue
  const white = [0xe8, 0xed, 0xf6];

  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const barH = size * 0.12;
  const barW = size * 0.44;
  const plateW = size * 0.11;
  const plateH = size * 0.30;

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // vertical gradient background
      const t = y / size;
      let r = Math.round(bg1[0] + t * 12);
      let g = Math.round(bg1[1] + t * 16);
      let b = Math.round(bg1[2] + t * 24);
      let a = 255;

      const inBar = Math.abs(y - cy) <= barH / 2 && Math.abs(x - cx) <= barW / 2;
      const inLeftPlate =
        Math.abs(y - cy) <= plateH / 2 && x >= cx - barW / 2 - plateW && x <= cx - barW / 2;
      const inRightPlate =
        Math.abs(y - cy) <= plateH / 2 && x <= cx + barW / 2 + plateW && x >= cx + barW / 2;

      if (inBar) [r, g, b] = white;
      if (inLeftPlate || inRightPlate) [r, g, b] = accent;

      const off = 1 + x * 4;
      row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = makePng(size);
  writeFileSync(join(outDir, `icon-${size}.png`), png);
  console.log(`wrote public/icons/icon-${size}.png (${png.length} bytes)`);
}
