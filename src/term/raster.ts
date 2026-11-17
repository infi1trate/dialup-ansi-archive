// DOM-free rasterizer (server share cards, tests): terminal cells -> RGB bytes, same rules as the renderer.
import { Terminal } from "./terminal";
import { VGA_RGB } from "./palette";
import { VGA_8X16_B64 } from "./vga-font";

let FONT: Uint8Array | null = null;
function font() {
  if (!FONT) { const b = atob(VGA_8X16_B64); FONT = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) FONT[i] = b.charCodeAt(i); }
  return FONT;
}
const fromAbgr = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];

/** Rasterize the first `maxRows` rows of the terminal's history (top of the piece). */
export function rasterize(t: Terminal, maxRows = t.rows) {
  const cw = t.ninePixel && !t.font ? 9 : 8;
  const gh = t.font?.height ?? 16;
  const f = t.font?.bytes ?? font();
  const pal = t.palette ? Array.from(t.palette, fromAbgr) : VGA_RGB;
  const used = Math.min(maxRows, t.lines.length);
  const fw = t.cols * cw, fh = used * gh;
  const fb = new Uint8Array(fw * fh * 3);
  for (let row = 0; row < used; row++) {
    const line = t.lines[row], ext = t.ext[row];
    for (let col = 0; col < t.cols; col++) {
      const cell = line[col];
      const ch = cell & 0xff, at = cell >> 8;
      let fg = pal[at & 15], bg = pal[((at >> 4) & 7) | (t.ice && at & 0x80 ? 8 : 0)];
      if (ext?.[col * 2]) { const v = ext[col * 2]; fg = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
      if (ext?.[col * 2 + 1]) { const v = ext[col * 2 + 1]; bg = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
      for (let r = 0; r < gh; r++) {
        const b = f[ch * gh + r];
        const bits = (b << 1) | (cw === 9 && ch >= 0xc0 && ch <= 0xdf ? b & 1 : 0);
        for (let c = 0; c < cw; c++) {
          const k = bits & (0x100 >> c) ? fg : bg;
          const o = ((row * gh + r) * fw + col * cw + c) * 3;
          fb[o] = k[0]; fb[o + 1] = k[1]; fb[o + 2] = k[2];
        }
      }
    }
  }
  return { fb, fw, fh };
}
