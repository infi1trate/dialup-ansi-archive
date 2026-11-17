// Helper for authoring ANSI/CP437 byte streams in code.
import { encode } from "@/term/cp437";
import { ANSI_VGA } from "@/term/terminal";

export const ESC = "\x1b[";

export class Ansi {
  private out: number[] = [];
  /** Last SGR emitted by c(); repeated colors are skipped (every byte costs line time). raw() forgets it. */
  private cur = "";
  private emit(s: string) { for (let i = 0; i < s.length; i++) this.out.push(s.charCodeAt(i) & 0xff); return this; }
  /** Text in Unicode; box/block characters are encoded to CP437. */
  t(s: string) { for (const b of encode(s)) this.out.push(b); return this; }
  raw(s: string) { this.cur = ""; return this.emit(s); }
  bytes(b: ArrayLike<number>) { this.cur = ""; for (let i = 0; i < b.length; i++) this.out.push(b[i]); return this; }
  /** Set colors: fg 0-15, bg 0-7 (bg 8-15 sets the blink/iCE bit). */
  c(fg: number, bg = 0) {
    let s = `${ESC}0`;
    if (fg & 8) s += ";1";
    if (bg & 8) s += ";5";
    s += `;3${ANSI_VGA[fg & 7]}`;
    if (bg & 7) s += `;4${ANSI_VGA[bg & 7]}`;
    s += "m";
    if (s === this.cur) return this;
    this.emit(s); this.cur = s; return this;
  }
  /** Shorthand: colored text. */
  k(fg: number, s: string, bg = 0) { return this.c(fg, bg).t(s); }
  reset() { return this.raw(`${ESC}0m`); }
  cls() { return this.raw(`${ESC}0m${ESC}2J`); }
  at(row: number, col: number) { return this.emit(`${ESC}${row};${col}H`); }
  eol() { return this.emit(`${ESC}K`); }
  nl(n = 1) { for (let i = 0; i < n; i++) this.emit("\r\n"); return this; }
  rep(ch: string, n: number) { return this.t(ch.repeat(Math.max(0, n))); }
  /** Hotkey in brackets: [X]label */
  hot(key: string, label: string, kc = 15, bc = 5, lc = 3) {
    return this.k(bc, "[").k(kc, key).k(bc, "]").k(lc, label);
  }
  build() { return new Uint8Array(this.out); }
  get length() { return this.out.length; }
}

export const a = () => new Ansi();

export function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
export function rpad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }
export function center(s: string, n: number) { const l = Math.max(0, Math.floor((n - s.length) / 2)); return pad(" ".repeat(l) + s, n); }

/** Double-line box. */
export function box(x: Ansi, row: number, col: number, w: number, h: number, fg: number, title?: string, fill = true, bg = 0) {
  x.c(fg, bg).at(row, col).t("╔").rep("═", w - 2).t("╗");
  for (let r = 1; r < h - 1; r++) {
    x.at(row + r, col).c(fg, bg).t("║");
    if (fill) x.c(7, bg).rep(" ", w - 2); else x.at(row + r, col + w - 1);
    x.c(fg, bg).t("║");
  }
  x.at(row + h - 1, col).c(fg, bg).t("╚").rep("═", w - 2).t("╝");
  if (title) x.at(row, col + 2).k(fg, "╡", bg).k(15, ` ${title} `, bg).k(fg, "╞", bg);
  return x;
}

// ── Block-letter logo font (5x6 pixels per glyph, drawn with half blocks) ──
const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#"], B: ["####.", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", ".####"], D: ["####.", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "####.", "#....", "#....", "#####"], F: ["#####", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#.###", "#...#", "#...#", ".####"], H: ["#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "#####"], J: ["..###", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "###..", "#..#.", "#...#", "#...#"], L: ["#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#"], N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", ".###."], P: ["####.", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"], R: ["####.", "#...#", "####.", "#..#.", "#...#", "#...#"],
  S: [".####", "#....", ".###.", "....#", "....#", "####."], T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", ".###."], V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"], X: ["#...#", ".#.#.", "..#..", "..#..", ".#.#.", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], Z: ["#####", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", ".###."], "1": ["..#..", ".##..", "..#..", "..#..", "..#..", ".###."],
  "3": ["####.", "....#", ".###.", "....#", "....#", "####."], "9": [".###.", "#...#", ".####", "....#", "....#", ".###."],
  "'": ["..#..", "..#..", ".....", ".....", ".....", "....."], "-": [".....", ".....", ".###.", ".....", ".....", "....."],
  " ": ["...", "...", "...", "...", "...", "..."],
};

/** Render big block letters: returns 3 text rows. Colors per row, shade shadow to the right. */
export function bigText(x: Ansi, row: number, col: number, text: string, colors: [number, number, number], shadow = 8) {
  const px: boolean[][] = Array.from({ length: 6 }, () => []);
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < 6; r++) { for (const p of g[r]) px[r].push(p === "#"); px[r].push(false); }
  }
  const w = px[0].length;
  for (let tr = 0; tr < 3; tr++) {
    x.at(row + tr, col);
    let lastColor = -1;
    for (let c = 0; c < w; c++) {
      const top = px[tr * 2][c], bot = px[tr * 2 + 1][c];
      let ch = " ", color = colors[tr];
      if (top && bot) ch = "█"; else if (top) ch = "▀"; else if (bot) ch = "▄";
      else if (c > 0 && (px[tr * 2][c - 1] || px[tr * 2 + 1][c - 1])) { ch = "░"; color = shadow; }
      if (ch !== " " && color !== lastColor) { x.c(color); lastColor = color; }
      x.t(ch);
    }
  }
  return w;
}

/** Shade gradient bar: ░▒▓█▓▒░ */
export function shadeBar(x: Ansi, width: number, fg: number) {
  const ramp = "░▒▓█";
  const seg = Math.floor(width / 2);
  for (let i = 0; i < width; i++) {
    const d = i < seg ? i : width - 1 - i;
    x.k(fg, ramp[Math.min(3, Math.floor((d / Math.max(1, seg)) * 4))]);
  }
  return x;
}

/**
 * Chrome block letters: 6 pixel rows packed into 3 text rows with two-color half blocks, so each pixel row
 * gets its own color (a vertical gradient). Where both halves are lit the lower color is the background, so it must be 1-7
 * to show (bright or black lower colors fall back to a solid block in the upper color).
 * A ░ shadow trails each stroke. Returns the width in columns.
 */
export function chromeText(x: Ansi, row: number, col: number, text: string, ramp: [number, number, number, number, number, number], shadow = 8) {
  const px: boolean[][] = Array.from({ length: 6 }, () => []);
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < 6; r++) { for (const p of g[r]) px[r].push(p === "#"); px[r].push(false); }
  }
  const w = px[0].length;
  for (let tr = 0; tr < 3; tr++) {
    x.at(row + tr, col);
    const ct = ramp[tr * 2], cb = ramp[tr * 2 + 1];
    for (let c = 0; c < w; c++) {
      const top = px[tr * 2][c], bot = px[tr * 2 + 1][c];
      if (top && bot) { if (cb === ct || cb >= 8 || cb === 0) x.c(ct).t("█"); else x.c(ct, cb).t("▀"); }
      else if (top) x.c(ct).t("▀");
      else if (bot) x.c(cb).t("▄");
      else if (c > 0 && (px[tr * 2][c - 1] || px[tr * 2 + 1][c - 1])) x.c(shadow).t("░");
      else x.c(7).t(" ");
    }
  }
  return x.reset(), w;
}

/** The basement stairwell, 24 x 7, top-left at (row, col): bare bulb, the 486 glowing on its desk, stairs going up. */
export function stairwell(x: Ansi, row: number, col: number, screen = 11) {
  const L: [number, string][][] = [
    [[8, "──┬──"], [0, "              "], [6, "  ▄▄▄"]],
    [[8, "  │  "], [0, "           "], [6, "▄▄▄█"], [8, "▓▓▓▓"]],
    [[14, "  ☼  "], [0, "        "], [6, "▄▄▄█"], [8, "▓▓▓▓▓▓▓"]],
    [[0, " "], [7, "▄▄▄▄"], [0, "     "], [6, "▄▄▄█"], [8, "▓▓▓▓▓▓▓▓▓▓"]],
    [[0, " "], [7, "█"], [screen, "▒▒"], [7, "█"], [0, "  "], [6, "▄▄▄█"], [8, "▓▓▓▓▓▓▓▓▓▓▓▓▓"]],
    [[0, " "], [6, "▀██▀▀▀▀"], [6, "█"], [8, "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓"]],
    [[8, "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀"]],
  ];
  L.forEach((segs, i) => { x.at(row + i, col); for (const [c, s] of segs) x.k(c, s); });
  return x.reset();
}
