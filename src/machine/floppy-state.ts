// Which desk floppy sits in drive A:. Tiny on purpose: the room imports it on first load; disk contents live in floppy.ts.
export type DiskId = 1 | 2 | 3 | 4;
export const DISK_IDS: DiskId[] = [1, 2, 3, 4];
/** Handwriting on each paper label, one entry per line. */
export const DISK_LABELS: Record<DiskId, string[]> = { 1: ["GAMES #2"], 2: ["do NOT format"], 3: ["ansi stuff", "mine"], 4: ["??? from Dave"] };
const FLOPPY_KEY = "dialup.floppy.v1";
export function loadFloppy(): DiskId | null {
  try { const v = Number(localStorage.getItem(FLOPPY_KEY)); return DISK_IDS.includes(v as DiskId) ? (v as DiskId) : null; } catch { return null; }
}
export function saveFloppy(d: DiskId | null) { try { if (d) localStorage.setItem(FLOPPY_KEY, String(d)); else localStorage.removeItem(FLOPPY_KEY); } catch { /* private mode */ } }
