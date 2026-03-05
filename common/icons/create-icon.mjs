#!/usr/bin/env node
/**
 * Generates common/icons/icon.ico — a sword icon shared by both
 * the Electron and Tauri overlay apps.
 *
 * Run once (or when you want to update the icon):
 *   node common/icons/create-icon.mjs
 *
 * No npm packages needed — uses only Node.js built-ins.
 */

import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Design (32×32 reference grid) ───────────────────────────────────────────
// '.' = background (#1a1a2e dark navy), 'X' = gold sword (#c8a951)
const GRID = [
  '................................',
  '...............XX...............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '........XXXXXXXXXXXXXXXX........',  // crossguard
  '........XXXXXXXXXXXXXXXX........',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '..............XXXX..............',
  '.............XXXXXX.............',  // pommel
  '.............XXXXXX.............',
  '................................',
  '................................',
];

const BG = [26,  26,  46,  255];  // #1a1a2e
const SW = [200, 169, 81,  255];  // #c8a951

function makePixels(size) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(x * 32 / size);
      const sy = Math.floor(y * 32 / size);
      const c  = GRID[sy][sx] === 'X' ? SW : BG;
      const i  = (y * size + x) * 4;
      px[i] = c[0]; px[i+1] = c[1]; px[i+2] = c[2]; px[i+3] = c[3];
    }
  }
  return px;
}

// ─── PNG encoder (pure Node.js, no deps) ─────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.allocUnsafe(4); l.writeUInt32BE(data.length);
  const r = Buffer.allocUnsafe(4); r.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, r]);
}

function makePNG(size, px) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA

  const stride = 1 + size * 4;
  const raw = Buffer.allocUnsafe(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst] = px[src]; raw[dst+1] = px[src+1]; raw[dst+2] = px[src+2]; raw[dst+3] = px[src+3];
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ICO builder (PNG-in-ICO, Windows Vista+) ────────────────────────────────
function makeICO(sizes) {
  const pngs = sizes.map(s => makePNG(s, makePixels(s)));

  const hdr = Buffer.allocUnsafe(6);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const dirs = sizes.map((s, i) => {
    const d = Buffer.allocUnsafe(16);
    d[0] = s === 256 ? 0 : s; d[1] = s === 256 ? 0 : s;
    d[2] = 0; d[3] = 0;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(pngs[i].length, 8);
    d.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return d;
  });

  return Buffer.concat([hdr, ...dirs, ...pngs]);
}

// ─── Write ────────────────────────────────────────────────────────────────────
const ico = makeICO([16, 32, 48, 256]);
const out = join(__dirname, 'icon.ico');
writeFileSync(out, ico);
console.log(`icon.ico written (${ico.length} bytes, sizes: 16×16, 32×32, 48×48, 256×256)`);
