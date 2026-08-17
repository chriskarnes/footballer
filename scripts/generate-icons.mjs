/**
 * Regenerates public/ icons from vector art.
 *
 *   node scripts/generate-icons.mjs
 *
 * In the repo rather than in someone's scratch directory because the icon set
 * has now been regenerated twice — once for the Train.futbol rename and once
 * for the monochrome palette — and both times the art existed only inside the
 * PNGs it produced. The source of an image should be readable.
 *
 * INK and PAPER are inverse-surface and inverse-primary from globals.css: the
 * icon is the primary button, cut out and given corners. If the palette moves
 * again, move these two values and run it.
 *
 * The mark is a T with the dot from ".futbol" beside it. The wordmark dropped
 * its monogram because a domain name reads as one word and a tile in front of
 * it makes you parse two; an app icon has no word beside it to compete with,
 * and at 16px it has to be one shape.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const INK = '#1B1B1B';
const PAPER = '#FFFFFF';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Paths rather than text: no font to resolve, identical on every machine. */
const markFull = `
  <rect x="88"  y="140" width="280" height="78"  rx="8" fill="${PAPER}"/>
  <rect x="189" y="140" width="78"  height="256" rx="8" fill="${PAPER}"/>
  <circle cx="396" cy="367" r="29" fill="${PAPER}"/>`;

/** Dotless and larger, for sizes where the dot is one muddy pixel. */
const markCompact = `
  <rect x="96"  y="132" width="320" height="90"  rx="9" fill="${PAPER}"/>
  <rect x="211" y="132" width="90"  height="288" rx="9" fill="${PAPER}"/>`;

const svg = ({ mark = markFull, radius = 114, scale = 1 } = {}) => {
  const t = scale === 1 ? mark
    : `<g transform="translate(${256 * (1 - scale)}, ${256 * (1 - scale)}) scale(${scale})">${mark}</g>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
       <rect width="512" height="512" rx="${radius}" fill="${INK}"/>${t}</svg>`
  );
};

const png = (source, size) =>
  sharp(source, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const write = (name, buf) => {
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(24)} ${buf.length} bytes`);
};

// Rounded tile, for the icons that sit on a home screen unmasked.
const tile = svg();
// Maskable wants full bleed and the 20% safe zone: Android crops to whatever
// shape the launcher uses, and a rounded tile inside a circle loses its corners.
const maskable = svg({ radius: 0, scale: 0.6 });
// Small sizes: dotless, and barely rounded — a 16px corner radius is one grey
// pixel pretending to be a curve.
const small = svg({ mark: markCompact, radius: 64 });

write('icon-512.png', await png(tile, 512));
write('icon.png', await png(tile, 512));
write('icon-192.png', await png(tile, 192));
write('icon-maskable-512.png', await png(maskable, 512));
write('apple-touch-icon.png', await png(tile, 180));
write('favicon.png', await png(small, 32));

/**
 * ICO with PNG-compressed entries at 16/32/48. Every browser shipped this
 * decade reads PNG inside ICO; the alternative is writing a BMP encoder for a
 * file only legacy tabs ask for.
 */
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(small, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);              // reserved
header.writeUInt16LE(1, 2);              // type 1 = icon
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);                    // width
  e.writeUInt8(s, 1);                    // height
  e.writeUInt8(0, 2);                    // palette size
  e.writeUInt8(0, 3);                    // reserved
  e.writeUInt16LE(1, 4);                 // colour planes
  e.writeUInt16LE(32, 6);                // bits per pixel
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});
write('favicon.ico', Buffer.concat([header, ...dir, ...images]));
