// Server-only: 1200x630 share image for /p/<id>: the lamp-off room photo with the card's first line on the CRT.
import { VGA_8X16_B64 } from "@/term/vga-font";
import { encode } from "@/term/cp437";
const W = 1200, H = 630;
let FONT: Uint8Array | null = null;
const font = () => { if (!FONT) { const b = atob(VGA_8X16_B64); FONT = Uint8Array.from(b, (c) => c.charCodeAt(0)); } return FONT; };

export async function renderPostcardCard(firstLine: string, from: string): Promise<Uint8Array> {
  const g = globalThis as any;
  if (typeof g.Buffer === "undefined") g.Buffer = { from: (a: ArrayLike<number>) => Uint8Array.from(a), alloc: (n: number) => new Uint8Array(n) };
  const jpeg = (await import("jpeg-js")).default as any;
  const { POSTCARD_BASE_B64 } = await import("./postcard-base");
  const base = jpeg.decode(Uint8Array.from(atob(POSTCARD_BASE_B64), (c) => c.charCodeAt(0)), { useTArray: true, formatAsRGBA: true });
  const px: Uint8Array = base.data;
  const blend = (x: number, y: number, c: number[], k: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; for (let i = 0; i < 3; i++) px[o + i] = Math.min(255, px[o + i] * (1 - k) + c[i] * k); };
  // a dark lit tube inside the glass
  for (let y = 80; y < 490; y++) for (let x = 312; x < 892; x++) blend(x, y, [6, 10, 14], 0.55);
  const text = (s: string, x0: number, y0: number, scale: number, c: number[]) => {
    const f = font(), b = encode(s);
    for (let n = 0; n < b.length; n++) for (let r = 0; r < 16; r++) { const bits = f[b[n] * 16 + r]; for (let i = 0; i < 8; i++) if (bits & (0x80 >> i)) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const X = x0 + (n * 8 + i) * scale + dx, Y = y0 + r * scale + dy; blend(X, Y, c, 0.95); blend(X, Y + 1, c, 0.15); } }
  };
  const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max - 3) + "..." : s);
  text("POSTCARD FROM " + fit(from.toUpperCase(), 14), 340, 150, 2, [85, 255, 255]);
  text(fit(firstLine, 66), 340, 230, 1, [235, 235, 235]);
  text("CONNECT 2400", 340, 270, 1, [170, 170, 170]);
  text("_", 340, 300, 1, [235, 235, 235]);
  // caption band
  for (let y = 548; y < H; y++) for (let x = 0; x < W; x++) blend(x, y, [8, 8, 10], 0.82);
  const cap = "You have mail. 2400 baud.";
  text(cap, Math.round((W - cap.length * 24) / 2), 566, 3, [255, 255, 85]);
  const out = jpeg.encode({ data: px, width: W, height: H }, 80);
  return new Uint8Array(out.data);
}
