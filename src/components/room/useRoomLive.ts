import { useEffect } from "react";
import { audio } from "@/audio/bus";
import { screenAverageColor } from "@/machine/signals";

interface Opts { root: React.RefObject<HTMLElement | null>; getState: () => string; reduced: boolean }

/**
 * Drives everything that changes in the room without React re-renders: screen-spill light
 * (CSS variables, ~10 Hz with smoothing), modem/HDD LEDs, the occasional headlight sweep.
 */
export function useRoomLive({ root, getState, reduced }: Opts) {
  useEffect(() => {
    const el = root.current; if (!el) return;
    const led = (n: string) => el.querySelector<HTMLElement>(`[data-led="${n}"]`);
    const leds = Object.fromEntries(["HS", "AA", "CD", "OH", "RD", "SD", "TR", "MR", "hdd"].map((n) => [n, led(n)])) as Record<string, HTMLElement | null>;
    const set = (n: string, on: boolean) => { const l = leds[n]; if (l && l.classList.contains("is-on") !== on) l.classList.toggle("is-on", on); };
    let oh = false, cd = false, hs = false, rdUntil = 0, sdUntil = 0, hddUntil = 0, pc = audio.status.pc;
    const offs = [
      audio.on("offHook", () => { oh = true; }),
      audio.on("connect", (bps) => { cd = true; hs = bps >= 14400; }),
      audio.on("hangup", () => { oh = false; cd = false; hs = false; }),
      audio.on("powerOn", () => { pc = true; }),
      audio.on("powerOff", () => { pc = false; oh = cd = hs = false; }),
      audio.on("byteFlow", () => { rdUntil = performance.now() + 300; }),
      audio.on("keyDown", () => { if (cd) sdUntil = performance.now() + 70; }),
      audio.on("diskSeek", () => { if (pc) hddUntil = performance.now() + 160 + Math.random() * 360; }),
      audio.on("floppySeek", () => { if (pc) hddUntil = performance.now() + 120; }),
    ];
    // smoothed screen light
    const cur = [0, 0, 0];
    let tgt: [number, number, number] = [0, 0, 0];
    const unsub = screenAverageColor.subscribe((v) => { tgt = v; });
    let raf = 0, lastLight = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const st = getState();
      set("MR", pc); set("TR", pc && st !== "off" && st !== "boot" && st !== "dos");
      set("OH", pc && oh); set("CD", pc && cd); set("HS", pc && hs); set("AA", false);
      set("RD", pc && cd && now < rdUntil && Math.random() < 0.6);
      set("SD", pc && now < sdUntil);
      set("hdd", pc && now < hddUntil && Math.random() < 0.7);
      if (now - lastLight < 100) return;
      lastLight = now;
      for (let i = 0; i < 3; i++) cur[i] += (tgt[i] - cur[i]) * 0.45;
      // light colour: hue of the screen, intensity grows with its brightness (soft knee)
      const mx = Math.max(cur[0], cur[1], cur[2], 0.001);
      const lum = (cur[0] * 0.3 + cur[1] * 0.55 + cur[2] * 0.15) / 255;
      const k = Math.min(1, Math.pow(mx / 255, 0.5) * 2.2);
      const s = el.style;
      s.setProperty("--sr", String(Math.round((cur[0] / mx) * 255 * k)));
      s.setProperty("--sg", String(Math.round((cur[1] / mx) * 255 * k)));
      s.setProperty("--sb", String(Math.round((cur[2] / mx) * 255 * k)));
      s.setProperty("--sk", k.toFixed(3));
      s.setProperty("--refl", (0.55 * (1 - Math.min(1, lum * 4))).toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    // a car goes past now and then
    let sweepT: ReturnType<typeof setTimeout>;
    const sweep = () => {
      sweepT = setTimeout(() => {
        if (!reduced) { el.classList.remove("headlight"); void el.offsetWidth; el.classList.add("headlight"); }
        sweep();
      }, 18000 + Math.random() * 40000);
    };
    sweep();
    return () => { cancelAnimationFrame(raf); unsub(); offs.forEach((f) => f()); clearTimeout(sweepT); };
  }, [root, getState, reduced]);
}
