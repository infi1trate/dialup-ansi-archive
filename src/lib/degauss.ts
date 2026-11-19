// The degauss coil behind the monitor's blank badge: pure timing rules shared by the room and its tests.
export const DEGAUSS_RECHARGE_MS = 20_000;
export const DEGAUSS_MS = 1600;
export const DEGAUSS_DIM_MS = 300;
export type DegaussResult = "none" | "degauss" | "click";

/** A real coil needs its thermistor to cool: one full degauss every 20 s, a dull click in between, nothing with the tube off. */
export class DegaussCoil {
  private last = -Infinity;
  press(now: number, tubeOn: boolean): DegaussResult {
    if (!tubeOn) return "none";
    if (now - this.last < DEGAUSS_RECHARGE_MS) return "click";
    this.last = now;
    return "degauss";
  }
  /** Milliseconds until the next full degauss is available (0 = ready). */
  remaining(now: number) { return Math.max(0, DEGAUSS_RECHARGE_MS - (now - this.last)); }
}

/** Wobble envelope (0..1) at t seconds into a degauss: fast decaying, fully settled by 1.6 s. */
export function degaussEnvelope(t: number) {
  if (t < 0 || t >= DEGAUSS_MS / 1000) return 0;
  const tail = t < 1.3 ? 1 : 1 - (t - 1.3) / 0.3;
  return Math.exp(-t * 2.6) * tail;
}
