// Film mode only: pure helpers for the fake clock and for joining the recorded audio spans.

/** Today's date at 11:47:00 local time: the alarm clock reads 11:47 in every clip. */
export function filmDateBase(today: Date): number {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 47, 0, 0);
  return d.getTime();
}
/** The fake wall clock advances at half the film's virtual speed, so a long setup still shows 11:47. */
export const FILM_DATE_RATE = 0.5;

/** Sample spans [start, end) of one continuous render, joined with an equal-power crossfade at each cut.
 *  The incoming span pre-rolls `fade` samples so the total length equals the sum of the spans. */
export function spliceSpans(channels: Float32Array[], spans: [number, number][], fade = 480): Float32Array[] {
  const total = spans.reduce((n, [a, b]) => n + Math.max(0, b - a), 0);
  return channels.map((src) => {
    const out = new Float32Array(total); let at = 0;
    spans.forEach(([a, b], i) => {
      const len = Math.max(0, b - a);
      out.set(src.subarray(a, b), at);
      if (i > 0 && fade > 0) {
        const n = Math.min(fade, at, a);
        for (let k = 0; k < n; k++) {
          const x = (k + 0.5) / n, o = at - n + k;
          out[o] = out[o] * Math.cos(x * Math.PI / 2) + src[a - n + k] * Math.sin(x * Math.PI / 2);
        }
      }
      at += len;
    });
    return out;
  });
}
