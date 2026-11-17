// Server-only: share card PNG (1200x630) — the first 25 rows of a piece drawn by our own
// text-mode renderer logic inside a plain CRT bezel. The only place art exists as an image.
import { Terminal } from "@/term/terminal";
import { parseSauce } from "@/term/sauce";
import { VGA_RGB } from "@/term/palette";
import { VGA_8X16_B64 } from "@/term/vga-font";

const W = 1200, H = 630;
let FONT: Uint8Array | null = null;
function font() {
  if (!FONT) { const b = atob(VGA_8X16_B64); FONT = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) FONT[i] = b.charCodeAt(i); }
  return FONT;
}

class Img {
  px = new Uint8Array(W * H * 4);
  set(x: number, y: number, [r, g, b]: number[]) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4; this.px[o] = r; this.px[o + 1] = g; this.px[o + 2] = b; this.px[o + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: number[]) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  text(s: string, x: number, y: number, scale: number, c: number[]) {
    const f = font();
    for (let n = 0; n < s.length; n++) {
      const ch = s.charCodeAt(n) & 0xff;
      for (let r = 0; r < 16; r++) { const bits = f[ch * 16 + r]; for (let b = 0; b < 8; b++) if (bits & (0x80 >> b)) this.rect(x + (n * 8 + b) * scale, y + r * scale, scale, scale, c); }
    }
  }
}

/** Render the top of a piece into a cells framebuffer, returns RGB rows sized cols*cw x rows*16. */
function screen(bytes: Uint8Array) {
  const art = parseSauce(bytes);
  const s = art.sauce;
  let cols = 80;
  if (s && s.dataType === 1 && s.tInfo1 > 80 && s.tInfo1 <= 320) cols = s.tInfo1;
  const t = new Terminal({ cols, ice: !!s?.ice, ninePixel: s?.letterSpacing !== 8 });
  t.feed(art.body);
  const cw = t.ninePixel ? 9 : 8, rows = t.rows;
  const fw = cols * cw, fh = rows * 16;
  const fb = new Uint8Array(fw * fh * 3);
  const f = font();
  for (let row = 0; row < rows; row++) {
    const line = t.lines[row];
    for (let col = 0; col < cols; col++) {
      const cell = line ? line[col] : 0x0720;
      const ch = cell & 0xff, at = cell >> 8;
      const fg = VGA_RGB[at & 15], bg = VGA_RGB[((at >> 4) & 7) | (t.ice && at & 0x80 ? 8 : 0)];
      for (let r = 0; r < 16; r++) {
        const b = f[ch * 16 + r];
        const bits = (b << 1) | (ch >= 0xc0 && ch <= 0xdf ? b & 1 : 0);
        for (let c = 0; c < cw; c++) {
          const on = bits & (0x100 >> c);
          const o = ((row * 16 + r) * fw + col * cw + c) * 3;
          const k = on ? fg : bg; fb[o] = k[0]; fb[o + 1] = k[1]; fb[o + 2] = k[2];
        }
      }
    }
  }
  return { fb, fw, fh };
}

export async function renderCard(bytes: Uint8Array, line1: string, line2: string): Promise<Uint8Array> {
  const img = new Img();
  img.rect(0, 0, W, H, [10, 9, 13]);
  // bezel + tube
  const sx = 240, sy = 40, sw = 720, sh = 400;
  img.rect(sx - 44, sy - 30, sw + 88, sh + 92, [176, 166, 138]);
  img.rect(sx - 40, sy - 26, sw + 80, sh + 84, [200, 190, 162]);
  img.rect(sx - 14, sy - 12, sw + 28, sh + 24, [24, 24, 22]);
  img.text("KESTREL VGA", sx - 30, sy + sh + 28, 1, [110, 100, 80]);
  img.rect(sx + sw - 4, sy + sh + 30, 10, 10, [60, 200, 90]);
  const { fb, fw, fh } = screen(bytes);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const o = ((Math.floor((y * fh) / sh) * fw) + Math.floor((x * fw) / sw)) * 3;
    const scan = y % 2 ? 0.86 : 1;
    img.set(sx + x, sy + y, [fb[o] * scan, fb[o + 1] * scan, fb[o + 2] * scan]);
  }
  const fit = (s: string, scale: number) => (s.length * 8 * scale > W - 40 ? s.slice(0, Math.floor((W - 40) / (8 * scale)) - 1) + "…".replace("…", ".") : s);
  const l1 = fit(line1, 2), l2 = fit(line2, 1);
  img.text(l1, Math.round((W - l1.length * 16) / 2), 530, 2, [85, 255, 255]);
  img.text(l2, Math.round((W - l2.length * 8) / 2), 584, 1, [170, 170, 170]);
  return png(img.px);
}

// ── minimal PNG encoder (RGBA, filter 0, zlib via CompressionStream) ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function png(rgba: Uint8Array) {
  const raw = new Uint8Array((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; raw.set(rgba.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1); }
  const z = new Uint8Array(await new Response(new Blob([raw as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
