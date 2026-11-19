// PRINT SCREEN: capture the 80x25 text screen exactly as displayed at the keypress, plus the footer rules. Pure.
export const PRINT_COLS = 80, PRINT_ROWS = 25;
export interface ScreenShot { chars: Uint8Array; attrs: Uint8Array }
interface TermLike { lines: Uint16Array[]; rows: number; top: number; viewOffset: number; cols: number }

/** The visible rows (honouring scrollback) as char + attribute bytes, 80 columns wide. */
export function captureScreen(t: TermLike): ScreenShot {
  const chars = new Uint8Array(PRINT_COLS * PRINT_ROWS).fill(32), attrs = new Uint8Array(PRINT_COLS * PRINT_ROWS).fill(7);
  const first = t.top - t.viewOffset;
  for (let r = 0; r < Math.min(PRINT_ROWS, t.rows); r++) {
    const line = t.lines[first + r]; if (!line) continue;
    for (let c = 0; c < Math.min(PRINT_COLS, t.cols); c++) { chars[r * PRINT_COLS + c] = line[c] & 255; attrs[r * PRINT_COLS + c] = line[c] >> 8; }
  }
  return { chars, attrs };
}
/** Three ink densities from the cell's foreground: 0 = nothing to print (black ink or blank). */
export function inkDensity(fg: number): 0 | 1 | 2 | 3 {
  if (fg === 0) return 0;
  if (fg >= 9) return 3;
  if (fg === 1 || fg === 4 || fg === 5 || fg === 8) return 1;
  return 2;
}
/** Block and shade glyphs (░▒▓█▄▌▐▀■) print their colour as a dot pattern; text glyphs keep every dot and print lighter instead. */
export const isBlockGlyph = (ch: number) => (ch >= 176 && ch <= 178) || (ch >= 219 && ch <= 223) || ch === 254;
/** Ink strength for text glyphs at each density (a worn ribbon), so thin strokes stay readable. */
export const TEXT_INK = [0, 0.5, 0.74, 1] as const;
/** Does dot (r, x) of a block glyph print at this density? Deterministic dither. */
export function dotOn(density: 0 | 1 | 2 | 3, r: number, x: number) {
  return density === 3 || (density === 2 && (r + x) % 4 !== 0) || (density === 1 && (r + x) % 2 === 0);
}
/** Footer line: the board's name and number on a call, the local machine otherwise; date in the fiction's 1993. */
export function printFooter(board: { name: string; number: string } | null, d: Date) {
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-93`;
  return board ? `${board.name}   ${board.number}   ${date}` : `KESTREL 486   LOCAL   ${date}`;
}
