// Tiny observable value, used for screenAverageColor and machine state.
export class Signal<T> {
  private subs = new Set<(v: T) => void>();
  constructor(public value: T) {}
  set(v: T) { this.value = v; this.subs.forEach((f) => f(v)); }
  subscribe(f: (v: T) => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
}

/** Average RGB of the terminal framebuffer, updated ~10x/second (for room lighting later). */
export const screenAverageColor = new Signal<[number, number, number]>([0, 0, 0]);
export const screenPictureBrightness = new Signal(0);

/** Ten-second tape: deck state for the REC LED and TELEWIRE, and the board being called (file name). */
export const tapeState = new Signal<"idle" | "armed" | "rec">("idle");
export const tapeArmRequest = new Signal(0);
export const currentBoardName = new Signal<string | null>(null);

/** Which desk floppy is in drive A: (null = empty). Set by the room, read by Kestrel DOS. */
export const floppyDisk = new Signal<1 | 2 | 3 | 4 | null>(null);
