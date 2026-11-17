// Keystroke queue between the physical keyboard and whatever program has the screen.
export interface Key { key: string; ch: number | null; ctrl: boolean; alt: boolean }

export class Aborted extends Error { constructor(public reason: string) { super(reason); } }

export class KeyQueue {
  private buf: Key[] = [];
  private waiter: { res: (k: Key | null) => void; rej: (e: Error) => void } | null = null;
  private aborted: string | null = null;

  push(k: Key) {
    if (this.waiter) { const w = this.waiter; this.waiter = null; w.res(k); }
    else if (this.buf.length < 32) this.buf.push(k);
  }
  next(): Promise<Key> {
    if (this.aborted) return Promise.reject(new Aborted(this.aborted));
    const k = this.buf.shift();
    if (k) return Promise.resolve(k);
    return new Promise((res, rej) => { this.waiter = { res: res as (k: Key | null) => void, rej }; });
  }
  /** Next key, or null if `p` settles first. Never swallows a key. */
  nextOr(p: Promise<unknown>): Promise<Key | null> {
    if (this.aborted) return Promise.reject(new Aborted(this.aborted));
    const k = this.buf.shift();
    if (k) return Promise.resolve(k);
    return new Promise((res, rej) => {
      const w = { res, rej };
      this.waiter = w;
      void p.then(() => { if (this.waiter === w) { this.waiter = null; res(null); } });
    });
  }
  /** Clear a sticky abort so programs can read keys again. */
  revive() { this.aborted = null; }
  get abortReason() { return this.aborted; }
  get hasKey() { return this.buf.length > 0; }
  clear() { this.buf = []; }
  abort(reason: string) {
    this.buf = [];
    this.aborted = reason;
    if (this.waiter) { const w = this.waiter; this.waiter = null; w.rej(new Aborted(reason)); }
  }
}

export function toKey(e: KeyboardEvent): Key {
  let ch: number | null = null;
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const c = e.key.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) ch = c;
  }
  return { key: e.key, ch, ctrl: e.ctrlKey, alt: e.altKey };
}
