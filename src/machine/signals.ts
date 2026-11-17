// Tiny observable value, used for screenAverageColor and machine state.
export class Signal<T> {
  private subs = new Set<(v: T) => void>();
  constructor(public value: T) {}
  set(v: T) { this.value = v; this.subs.forEach((f) => f(v)); }
  subscribe(f: (v: T) => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
}

/** Average RGB of the terminal framebuffer, updated ~10x/second (for room lighting later). */
export const screenAverageColor = new Signal<[number, number, number]>([0, 0, 0]);
