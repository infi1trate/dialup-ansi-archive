// The beach calendar's month page: the real current month, Sunday-first, today circled.
export const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
/** Weeks of the month as rows of seven (null outside the month), plus today's row and column. */
export function monthGrid(d: Date) {
  const y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < Math.ceil((first + days) / 7) * 7; i++) { if (i % 7 === 0) weeks.push([]); const n = i - first + 1; weeks[weeks.length - 1].push(n >= 1 && n <= days ? n : null); }
  const t = first + d.getDate() - 1;
  return { name: MONTHS[m], weeks, today: { row: Math.floor(t / 7), col: t % 7 } };
}
/** The lower sheet of the calendar in stage pixels (TL, TR, BR, BL), just inside the photographed paper edge. */
export const CAL_PAGE: readonly (readonly [number, number])[] = [[2031, 414], [2291, 406], [2289, 657], [2022, 662]];
/** Lamp-off paper is about a quarter as bright as lamp-on in the plates. */
export const CAL_OFF_RATIO = 0.25;
/** The month page canvas size. */
export const PAGE_W = 520, PAGE_H = 500;
const KEY = "dialup.calendar.flipped";
export function loadFlipped() { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function saveFlipped(on: boolean) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ } }
/** The owl hoots at most once every ten seconds. */
export const HOOT_GAP_MS = 10_000;
export const hootAllowed = (last: number, now: number) => now - last >= HOOT_GAP_MS;
