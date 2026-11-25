import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// A self-contained, deterministic 24 November 2026 world-news graphic.
// News facts are embedded here; rendering never reads the network or the clock.
const W = 1024, H = 1024;
const pixels = Buffer.alloc(W * H * 4);
type Color = [number, number, number, number];
const C = {
  bg: [10, 20, 34, 255] as Color, panel: [20, 36, 54, 255] as Color,
  panel2: [25, 44, 64, 255] as Color, ink: [244, 247, 242, 255] as Color,
  muted: [173, 190, 202, 255] as Color, dim: [102, 127, 145, 255] as Color,
  gold: [255, 193, 76, 255] as Color, red: [255, 105, 94, 255] as Color,
  blue: [91, 174, 255, 255] as Color, green: [87, 213, 164, 255] as Color,
  purple: [194, 151, 255, 255] as Color, white: [255, 255, 255, 255] as Color,
};
function rect(x: number, y: number, w: number, h: number, color: Color) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const i = (yy * W + xx) * 4;
    pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = color[3];
  }
}
function roundRect(x: number, y: number, w: number, h: number, r: number, color: Color) {
  rect(x + r, y, w - 2 * r, h, color); rect(x, y + r, r, h - 2 * r, color); rect(x + w - r, y + r, r, h - 2 * r, color);
  for (let yy = 0; yy < r; yy++) for (let xx = 0; xx < r; xx++) {
    const dx = r - xx - 0.5, dy = r - yy - 0.5;
    if (dx * dx + dy * dy <= r * r) {
      rect(x + xx, y + yy, 1, 1, color); rect(x + w - xx - 1, y + yy, 1, 1, color);
      rect(x + xx, y + h - yy - 1, 1, 1, color); rect(x + w - xx - 1, y + h - yy - 1, 1, 1, color);
    }
  }
}
function line(x1: number, y1: number, x2: number, y2: number, width: number, color: Color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x1 + (x2 - x1) * s / Math.max(steps, 1));
    const y = Math.round(y1 + (y2 - y1) * s / Math.max(steps, 1));
    rect(x - width / 2, y - width / 2, width, width, color);
  }
}
function circle(cx: number, cy: number, radius: number, color: Color, fill = true, stroke = 3) {
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
    const d = x * x + y * y;
    if (fill ? d <= radius * radius : d <= radius * radius && d >= (radius - stroke) * (radius - stroke)) rect(cx + x, cy + y, 1, 1, color);
  }
}

const glyph: Record<string, string[]> = {
  'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],
  'C':['01111','10000','10000','10000','10000','10000','01111'],'D':['11110','10001','10001','10001','10001','10001','11110'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],
  'G':['01111','10000','10000','10111','10001','10001','01111'],'H':['10001','10001','10001','11111','10001','10001','10001'],
  'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00010','00010','00010','10010','10010','01100'],
  'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],
  'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],
  'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],
  'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],
  'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],
  'W':['10001','10001','10001','10101','10101','10101','01010'],'X':['10001','10001','01010','00100','01010','10001','10001'],
  'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],',':['00000','00000','00000','00000','00110','00110','00100'],
  ':':['00000','00110','00110','00000','00110','00110','00000'],';':['00000','00110','00110','00000','00110','00110','00100'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],'/':['00001','00010','00010','00100','01000','01000','10000'],
  '!':['00100','00100','00100','00100','00100','00000','00100'],'?':['01110','10001','00001','00010','00100','00000','00100'],
  "'":['00100','00100','00000','00000','00000','00000','00000'],'&':['01100','10010','10100','01000','10101','10010','01101'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],'(':['00010','00100','01000','01000','01000','00100','00010'],
  ')':['01000','00100','00010','00010','00010','00100','01000'],'%':['11001','11010','00100','01000','10110','00110','00000'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};
function textWidth(s: string, scale: number) { return Math.max(0, s.length * 6 * scale - scale); }
function drawText(s: string, x: number, y: number, scale: number, color: Color) {
  let ox = x;
  for (const raw of s.toUpperCase()) {
    const rows = glyph[raw] ?? glyph[' '];
    for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) if (rows[yy][xx] === '1') rect(ox + xx * scale, y + yy * scale, scale, scale, color);
    ox += 6 * scale;
  }
}
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = s.toUpperCase().split(' '), lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (textWidth(next, scale) > maxWidth && current) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines;
}
function paragraph(s: string, x: number, y: number, width: number, scale: number, color: Color, maxLines: number) {
  const lines = wrap(s, width, scale).slice(0, maxLines);
  lines.forEach((v, i) => drawText(v, x, y + i * scale * 10, scale, color));
}
function iconBall(cx: number, cy: number, accent: Color) {
  circle(cx, cy, 38, accent, false, 5); circle(cx, cy, 12, accent, true);
  line(cx, cy - 12, cx, cy - 35, 4, accent); line(cx + 11, cy - 4, cx + 34, cy - 12, 4, accent);
  line(cx + 7, cy + 10, cx + 22, cy + 30, 4, accent); line(cx - 7, cy + 10, cx - 22, cy + 30, 4, accent);
  line(cx - 11, cy - 4, cx - 34, cy - 12, 4, accent);
}
function iconCity(cx: number, cy: number, accent: Color) {
  rect(cx - 38, cy - 30, 25, 82, C.panel2); rect(cx - 7, cy - 53, 30, 105, C.panel2); rect(cx + 29, cy - 13, 25, 65, C.panel2);
  for (let x = cx - 32; x < cx - 15; x += 11) for (let y = cy - 20; y < cy + 45; y += 20) rect(x, y, 5, 7, accent);
  for (let x = cx - 1; x < cx + 17; x += 11) for (let y = cy - 39; y < cy + 40; y += 21) rect(x, y, 5, 7, accent);
  line(cx - 47, cy + 53, cx + 48, cy + 53, 5, accent); line(cx - 5, cy - 59, cx + 8, cy - 72, 4, accent);
}
function iconVaccine(cx: number, cy: number, accent: Color) {
  roundRect(cx - 13, cy - 34, 27, 62, 7, accent); rect(cx - 18, cy - 40, 37, 9, C.ink);
  line(cx, cy + 28, cx, cy + 54, 4, accent); line(cx - 7, cy + 55, cx + 7, cy + 55, 4, accent);
  line(cx - 7, cy - 16, cx + 7, cy - 16, 3, C.panel); line(cx - 7, cy - 3, cx + 7, cy - 3, 3, C.panel);
  line(cx - 7, cy + 10, cx + 7, cy + 10, 3, C.panel);
  circle(cx + 39, cy - 28, 15, accent, false, 4); line(cx + 39, cy - 20, cx + 39, cy - 36, 4, accent); line(cx + 31, cy - 28, cx + 47, cy - 28, 4, accent);
}
function iconLock(cx: number, cy: number, accent: Color) {
  roundRect(cx - 35, cy - 4, 70, 58, 9, accent);
  circle(cx, cy - 13, 25, accent, false, 7); rect(cx - 25, cy - 12, 50, 18, C.panel);
  circle(cx, cy + 19, 6, C.panel); rect(cx - 3, cy + 19, 6, 15, C.panel);
  line(cx - 52, cy - 51, cx - 39, cy - 39, 4, accent); line(cx + 48, cy - 51, cx + 36, cy - 39, 4, accent);
}
function card(x: number, y: number, n: string, category: string, headline: string, detail: string, source: string, accent: Color, icon: (x:number,y:number,c:Color)=>void) {
  const cw = 470, ch = 358;
  roundRect(x, y, cw, ch, 18, C.panel);
  rect(x + 1, y + 19, 5, ch - 38, accent);
  drawText(n, x + 25, y + 22, 2, accent);
  drawText(category, x + 64, y + 21, 2, C.muted);
  icon(x + 77, y + 140, accent);
  const tx = x + 143, tw = 298;
  const hl = wrap(headline, tw, 3);
  hl.forEach((l, i) => drawText(l, tx, y + 76 + i * 32, 3, C.ink));
  paragraph(detail, tx, y + 76 + hl.length * 32 + 17, tw, 2, C.muted, 5);
  rect(tx, y + ch - 53, 42, 3, accent);
  drawText(source, tx, y + ch - 36, 1, C.dim);
}

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = (y * W + x) * 4;
  const t = y / H;
  pixels[k] = Math.round(9 + 6 * t); pixels[k + 1] = Math.round(19 + 8 * t); pixels[k + 2] = Math.round(33 + 10 * t); pixels[k + 3] = 255;
}
// Header: a restrained masthead and a date that remains clear at thumbnail size.
drawText('THE WORLD / DAILY BRIEF', 42, 34, 2, C.gold);
drawText('TUESDAY', 40, 70, 5, C.ink);
drawText('24 NOVEMBER 2026', 42, 117, 3, C.blue);
drawText('FOUR STORIES. ONE DAY. A WORLD IN MOTION.', 574, 121, 1, C.muted);
rect(40, 157, 944, 2, [67, 93, 113, 255]);

card(40, 180, '01', 'AFRICA / FOOTBALL', 'SENEGAL RESTORED AS AFCON CHAMPIONS',
  'SPORTS ARBITRATION COURT OVERTURNS THE DECISION THAT AWARDED THE 2025 TITLE TO MOROCCO.',
  'CAS RULING • REUTERS', C.gold, iconBall);
card(514, 180, '02', 'EUROPE / WAR', 'RUSSIAN STRIKE KILLS 2 IN ZAPORIZHZHIA',
  'AP REPORTS 48 WOUNDED, INCLUDING 4 CHILDREN, AFTER A NIGHTTIME ATTACK ON THE UKRAINIAN CITY.',
  'OFFICIALS VIA AP', C.red, iconCity);
card(40, 556, '03', 'MIDDLE EAST / AID', 'YEMEN: 350,000 CHILDREN MISS VACCINES',
  'UN SAYS FIGHTING BLOCKS SAFE ACCESS TO TAIZ; MEASLES AND RUBELLA SHOTS CANNOT REACH CHILDREN.',
  'UN OCHA / UN NEWS', C.green, iconVaccine);
card(514, 556, '04', 'UNITED STATES / CYBER', 'CIA OPEN-SOURCE SYSTEM BREACHED',
  'AP REPORTS AN UNCLASSIFIED SYSTEM WAS HACKED. NO CLASSIFIED DATA WAS INVOLVED; THE ISSUE WAS RESOLVED.',
  'AP • SOURCE ANONYMOUS', C.purple, iconLock);
rect(40, 958, 944, 2, [67, 93, 113, 255]);
drawText('SOURCES: ASSOCIATED PRESS  /  UNITED NATIONS  /  REUTERS', 42, 976, 1, C.dim);

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type, 'ascii'), out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length); return out;
}
const scanlines = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { const dst = y * (W * 4 + 1); scanlines[dst] = 0; pixels.copy(scanlines, dst + 1, y * W * 4, (y + 1) * W * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'entry.png'), png);
