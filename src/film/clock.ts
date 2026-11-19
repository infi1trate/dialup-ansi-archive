// Film mode only (never in production builds). A virtual clock for the whole page: timers, animation frames,
// performance.now, Date, Math.random and CSS/Web Animations all advance only when the film steps them, so a slow
// software-GL test browser still yields a perfect 30 fps film with sound in sync.
type Fn = (...a: unknown[]) => void;
interface Timer { id: number; at: number; fn: Fn; args: unknown[]; every: number | null; seq: number }

const macrotask = () => new Promise<void>((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

export function createClock(dateBase: number, dateRate: number, seed = 0x1147) {
  const w = window as unknown as Record<string, unknown>;
  const real = {
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
    now: performance.now.bind(performance), Date: window.Date,
  };
  let vnow = real.now(); const v0 = vnow;
  const timers = new Map<number, Timer>(); const rafs = new Map<number, FrameRequestCallback>();
  let nextId = 1_000_000_000, seq = 0;
  const add = (fn: unknown, ms: unknown, args: unknown[], every: boolean) => {
    const f = (typeof fn === "function" ? fn : () => { /* string timers are not used */ }) as Fn;
    const d = Math.max(every ? 1 : 0, Number(ms) || 0); const id = nextId++;
    timers.set(id, { id, at: vnow + d, fn: f, args, every: every ? d : null, seq: seq++ }); return id;
  };
  w.setTimeout = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, false);
  w.setInterval = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, true);
  w.clearTimeout = (id: number) => { if (!timers.delete(id)) real.clearTimeout(id); };
  w.clearInterval = (id: number) => { if (!timers.delete(id)) real.clearInterval(id); };
  w.requestAnimationFrame = (cb: FrameRequestCallback) => { const id = nextId++; rafs.set(id, cb); return id; };
  w.cancelAnimationFrame = (id: number) => { if (!rafs.delete(id)) real.caf(id); };
  Object.defineProperty(performance, "now", { configurable: true, value: () => vnow });
  const dateNow = () => Math.round(dateBase + (vnow - v0) * dateRate);
  const RealDate = real.Date;
  class FilmDate extends RealDate {
    constructor(...a: unknown[]) { if (a.length === 0) super(dateNow()); else super(...(a as [number])); }
    static override now() { return dateNow(); }
  }
  w.Date = FilmDate;
  let s = seed >>> 0; // mulberry32: the same busy signals, quotes and line noise in every take
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /** Fire every timer due up to `target`, in order, letting promises and React settle between them. */
  async function runTimers(target: number) {
    for (let n = 0; n < 4000; n++) {
      let best: Timer | null = null;
      for (const t of timers.values()) if (t.at <= target && (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq))) best = t;
      if (!best) break;
      vnow = Math.max(vnow, best.at);
      if (best.every !== null) { best.at += best.every; best.seq = seq++; } else timers.delete(best.id);
      try { best.fn(...best.args); } catch (e) { console.error(e); }
      await macrotask();
    }
    vnow = Math.max(vnow, target);
  }
  /** CSS transitions and animations follow the virtual clock too. */
  const started = new WeakMap<Animation, number>();
  function stepAnimations() {
    for (const a of document.getAnimations()) {
      let st = started.get(a);
      if (st === undefined) { st = vnow - (Number(a.currentTime) || 0); started.set(a, st); }
      const t = vnow - st, end = Number(a.effect?.getComputedTiming().endTime);
      try {
        if (a.playState !== "paused") a.pause();
        if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      } catch { /* an animation that went away mid-step */ }
    }
  }
  /** One display frame: every pending animation-frame callback with the virtual timestamp. */
  function runFrame() {
    const cbs = [...rafs.values()]; rafs.clear();
    for (const cb of cbs) { try { cb(vnow); } catch (e) { console.error(e); } }
  }
  return {
    now: () => vnow, dateNow, real, macrotask, runTimers, stepAnimations, runFrame,
    realSleep: (ms: number) => new Promise<void>((r) => real.setTimeout(r, ms)),
  };
}
export type FilmClock = ReturnType<typeof createClock>;
