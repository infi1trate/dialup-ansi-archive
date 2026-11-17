// Pixel-exact text-mode renderer: terminal cells -> RGBA framebuffer (no smoothing).
import { Terminal } from "./terminal";
import { VGA_U32 } from "./palette";
import { VGA_8X16_B64 } from "./vga-font";

let FONT: Uint8Array | null = null;
export function vgaFont(): Uint8Array {
  if (!FONT) {
    const bin = atob(VGA_8X16_B64);
    FONT = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) FONT[i] = bin.charCodeAt(i);
  }
  return FONT;
}

/** Bit masks per glyph row, widened to 9 columns (9th column repeats the 8th for 0xC0-0xDF). */
let GLYPH9: Uint16Array | null = null;
function glyphs9() {
  if (!GLYPH9) {
    const f = vgaFont();
    GLYPH9 = new Uint16Array(4096);
    for (let g = 0; g < 256; g++) for (let r = 0; r < 16; r++) {
      const b = f[g * 16 + r];
      const ninth = g >= 0xc0 && g <= 0xdf ? b & 1 : 0;
      GLYPH9[g * 16 + r] = (b << 1) | ninth; // bit 8 = leftmost pixel
    }
  }
  return GLYPH9;
}

export class TermRenderer {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData | null = null;
  private px: Uint32Array | null = null;
  private lastKey = "";
  /** Average RGB of the last rendered frame, 0-255. */
  avg: [number, number, number] = [0, 0, 0];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  /** Returns true if the framebuffer changed. */
  render(t: Terminal, blinkOn: boolean, cursorOn: boolean): boolean {
    const cw = t.ninePixel ? 9 : 8;
    const W = t.cols * cw, H = t.rows * 16;
    const key = `${t.version}|${blinkOn}|${cursorOn}|${W}|${t.overlay?.version ?? -1}`;
    if (key === this.lastKey) return false;
    this.lastKey = key;
    if (this.canvas.width !== W || this.canvas.height !== H || !this.img) {
      this.canvas.width = W; this.canvas.height = H;
      this.img = this.ctx.createImageData(W, H);
      this.px = new Uint32Array(this.img.data.buffer);
    }
    const px = this.px!;
    const G = glyphs9();
    const start = t.top - t.viewOffset;
    for (let row = 0; row < t.rows; row++) {
      const line = t.lines[start + row];
      for (let col = 0; col < t.cols; col++) {
        const cell = line[col];
        const isCursor = cursorOn && t.cursorVisible && t.viewOffset === 0 && row === t.y && col === t.x;
        this.drawCell(px, W, col * cw, row * 16, cell, t.ice, blinkOn, isCursor, cw, G);
      }
    }
    const ov = t.overlay;
    if (ov && ov.mask) {
      const ox = Math.floor((t.cols - 80) / 2) * cw;
      const oy = Math.floor((t.rows - 25) / 2) * 16;
      for (let row = 0; row < 25; row++) for (let col = 0; col < 80; col++) {
        if (!ov.mask[row * 80 + col]) continue;
        this.drawCell(px, W, ox + col * cw, oy + row * 16, ov.cell(row, col), false, blinkOn, false, cw, G);
      }
    }
    this.ctx.putImageData(this.img!, 0, 0);
    this.sampleAverage(px, W, H);
    return true;
  }

  private drawCell(px: Uint32Array, W: number, x0: number, y0: number, cell: number, ice: boolean,
    blinkOn: boolean, cursor: boolean, cw: number, G: Uint16Array) {
    const ch = cell & 0xff, a = cell >> 8;
    let fg = a & 15, bg = (a >> 4) & 7;
    if (a & 0x80) { if (ice) bg |= 8; else if (!blinkOn) fg = bg; }
    const F = VGA_U32[fg], B = VGA_U32[bg];
    const base = ch * 16;
    for (let r = 0; r < 16; r++) {
      const bits = cursor ? 0x1ff : G[base + r];
      let o = (y0 + r) * W + x0;
      for (let c = 0; c < cw; c++) px[o++] = bits & (0x100 >> c) ? F : B;
    }
  }

  private sampleAverage(px: Uint32Array, W: number, H: number) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 3; y < H; y += 8) for (let x = 2; x < W; x += 7) {
      const v = px[y * W + x]; r += v & 255; g += (v >> 8) & 255; b += (v >> 16) & 255; n++;
    }
    this.avg = n ? [r / n, g / n, b / n] : [0, 0, 0];
  }
}
