// Renders a captured text screen as a 9-pin tractor-feed printout (1080x1350 PNG), reusing the bill printer's dot font.
import { dotFont } from "./bill-print";
import { dotOn, inkDensity, isBlockGlyph, TEXT_INK, PRINT_COLS, PRINT_ROWS, type ScreenShot } from "@/lib/printscreen";
import { encode } from "@/term/cp437";
import { DIRECTORY } from "@/bbs/io";
import { printFooter } from "@/lib/printscreen";

export const SHEET_W = 1080, SHEET_H = 1350;
const LEFT = 70, PITCH = (SHEET_W - LEFT * 2) / PRINT_COLS / 8, ROWH = PITCH * 12, TOP = 118;
/** Fraction of the sheet height that holds print (the room only raises this much). */
export const PRINTED_FRACTION = 0.56;

export function renderScreenPrint(shot: ScreenShot, footer: string) {
  const tokens = getComputedStyle(document.documentElement);
  const paper = tokens.getPropertyValue("--bill-paper").trim(), ink = tokens.getPropertyValue("--print-ink").trim(), edge = tokens.getPropertyValue("--bill-edge").trim();
  const canvas = document.createElement("canvas"); canvas.width = SHEET_W; canvas.height = SHEET_H;
  const c = canvas.getContext("2d"); if (!c) throw Error("Printer unavailable");
  const font = dotFont();
  c.fillStyle = paper; c.fillRect(0, 0, SHEET_W, SHEET_H);
  // sprocket strips: holes and the perforation beside them
  for (let y = 24; y < SHEET_H; y += 36) { c.fillStyle = edge; c.beginPath(); c.arc(24, y, 8, 0, Math.PI * 2); c.arc(SHEET_W - 24, y, 8, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = edge; c.lineWidth = 1.2; c.setLineDash([3, 5]); for (const x of [48, SHEET_W - 48]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, SHEET_H); c.stroke(); }
  c.setLineDash([6, 6]); c.beginPath(); c.moveTo(48, SHEET_H - 6); c.lineTo(SHEET_W - 48, SHEET_H - 6); c.stroke(); c.setLineDash([]);
  c.fillStyle = ink;
  const dot = (x: number, y: number, a: number) => { c.globalAlpha = a; c.beginPath(); c.arc(x, y, PITCH * 0.72, 0, Math.PI * 2); c.fill(); };
  const cell = (ch: number, density: 0 | 1 | 2 | 3, col: number, y: number) => {
    if (!density || ch === 32 || ch === 0) return;
    const g = font[ch], x0 = LEFT + col * PITCH * 8, block = isBlockGlyph(ch), fade = 0.92 - 0.14 * (x0 / SHEET_W);
    for (let r = 0; r < 9; r++) for (let x = 0; x < g[r].length; x++) if (g[r][x] && (!block || dotOn(density, r, x))) dot(x0 + x * PITCH + PITCH / 2, y + r * PITCH * 1.33, block ? fade : fade * TEXT_INK[density]);
  };
  const line = (text: string, col: number, y: number) => { const b = encode(text); for (let i = 0; i < b.length; i++) cell(b[i], 3, col + i, y); };
  line("KESTREL DOS  PRINT SCREEN  LPT1:", 0, TOP - ROWH * 2.2);
  for (let r = 0; r < PRINT_ROWS; r++) for (let col = 0; col < PRINT_COLS; col++) { const i = r * PRINT_COLS + col; cell(shot.chars[i], inkDensity(shot.attrs[i] & 15), col, TOP + r * ROWH); }
  const fy = TOP + PRINT_ROWS * ROWH + ROWH * 1.2;
  c.globalAlpha = 0.5; c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.moveTo(LEFT, fy - 6); c.lineTo(SHEET_W - LEFT, fy - 6); c.stroke();
  line(footer.slice(0, PRINT_COLS), 0, fy + 4);
  c.globalAlpha = 0.7; c.font = "12px monospace"; c.fillText("Dial-Up / dialup-ansi-archive.lovable.app", LEFT, fy + ROWH * 2.6);
  c.globalAlpha = 1;
  return canvas;
}
export function sheetBlob(canvas: HTMLCanvasElement) { return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(Error("Printer jammed"))), "image/png")); }
/** Footer + sheet + PNG for whatever the CRT showed at the keypress. */
export async function printScreen(shot: ScreenShot, boardName: string | null, now = new Date()) {
  const d = boardName ? DIRECTORY.find((e) => e.name === boardName) : null;
  const canvas = renderScreenPrint(shot, printFooter(d ? { name: d.name, number: d.number } : null, now));
  const blob = await sheetBlob(canvas);
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return { blob, name: `dialup-printout-${stamp}.png` };
}
