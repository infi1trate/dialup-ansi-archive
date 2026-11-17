// Byte scheduler: releases host bytes to the terminal at line speed (bps / 10 bytes per second).
export const SPEEDS = [2400, 9600, 14400, 28800] as const;
export type Speed = (typeof SPEEDS)[number];

export class Modem {
  bps = 9600;
  paused = false;
  private queue: Uint8Array[] = [];
  private off = 0;
  private acc = 0;
  private burst = 1;
  private waiters: (() => void)[] = [];
  /** Bytes delivered in the last tick, per second. */
  rate = 0;

  constructor(private sink: (b: Uint8Array) => void) {}

  write(bytes: Uint8Array) { if (bytes.length) this.queue.push(bytes); }

  get pending() {
    let n = -this.off;
    for (const q of this.queue) n += q.length;
    return Math.max(0, n);
  }
  get busy() { return this.queue.length > 0; }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  /** Deliver everything now. */
  flush() { this.deliver(Infinity); }

  /** Drop everything queued (carrier lost). */
  clear() { this.queue = []; this.off = 0; this.acc = 0; this.resolve(); }

  drain(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  tick(dt: number) {
    if (this.paused || !this.busy) { this.rate = 0; return; }
    // Slight burstiness: a random walk on throughput, like a real line under compression.
    this.burst += (Math.random() - 0.5) * 0.25;
    this.burst = Math.max(0.75, Math.min(1.2, this.burst + (1 - this.burst) * 0.1));
    this.acc += Math.min(dt, 0.1) * (this.bps / 10) * this.burst;
    const n = Math.floor(this.acc);
    this.acc -= n;
    this.rate = n / Math.max(dt, 1e-3);
    if (n > 0) this.deliver(n);
  }

  private deliver(n: number) {
    while (n > 0 && this.queue.length) {
      const q = this.queue[0];
      const take = Math.min(n, q.length - this.off);
      this.sink(q.subarray(this.off, this.off + take));
      this.off += take; n -= take;
      if (this.off >= q.length) { this.queue.shift(); this.off = 0; }
    }
    if (!this.busy) { this.acc = 0; this.resolve(); }
  }

  private resolve() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
}
