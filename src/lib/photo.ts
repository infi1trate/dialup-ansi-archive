// Instant photo rules: square crop around the monitor, the print's proportions, the handwritten caption, and the
// projective transform that lays a print over the photographed one on the cork board. Pure.
export type Box = readonly [number, number, number, number];
export const STAGE_W = 2560, STAGE_H = 1440;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Square [x, y, side] in stage pixels, centred on the monitor and kept inside the photograph. */
export function photoCrop(monitor: Box): [number, number, number] {
  const mw = monitor[2] * STAGE_W, mh = monitor[3] * STAGE_H;
  const side = Math.round(Math.min(STAGE_H, Math.max(mw, mh) * 1.025));
  const cx = (monitor[0] + monitor[2] / 2) * STAGE_W, cy = (monitor[1] + monitor[3] / 2) * STAGE_H;
  const x = Math.round(Math.min(STAGE_W - side, Math.max(0, cx - side / 2)));
  const y = Math.round(Math.min(STAGE_H - side, Math.max(0, cy - side / 2)));
  return [x, y, side];
}
/** Instant print proportions (88 x 107 mm, 79 mm square image, thick bottom border) at a given print width. */
export function printGeometry(width: number) {
  const mm = width / 88;
  return { w: width, h: Math.round(107 * mm), side: Math.round(4.5 * mm), top: Math.round(6 * mm), image: Math.round(79 * mm), bottom: Math.round(22 * mm) };
}
/** One fake year per device, 1990-1996, so a visitor's prints all come from the same "year". */
export function photoYear(rand: number) { return 1990 + Math.min(6, Math.floor(rand * 7)); }
/** Bottom-border caption: board name and number on a call, otherwise "the basement"; then the date as NOV '93. */
export function photoCaption(board: { name: string; number: string } | null, month: number, year: number) {
  return { where: board ? `${board.name} ${board.number}` : "the basement", when: `${MONTHS[month]} '${String(year).slice(2)}` };
}
/** CSS matrix3d mapping a w x h element (origin 0 0) onto quad TL, TR, BR, BL. */
export function quadMatrix3d(w: number, h: number, q: readonly (readonly [number, number])[]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return { css: `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`, map: (X: number, Y: number) => { const u = X / w, v = Y / h, z = g * u + hh * v + 1; return [(a * u + b * v + x0) / z, (d * u + e * v + y0) / z] as const; } };
}
/** The photographed print on the cork board (stage pixels, TL TR BR BL) and the pin that holds it. */
export const CORK_PRINT: readonly (readonly [number, number])[] = [[2371, 744], [2496, 759], [2492.5, 969], [2370, 942]];
export const CORK_PIN: Box = [2429, 745, 20, 22];
