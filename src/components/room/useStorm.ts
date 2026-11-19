import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "@/audio/bus";
import { FLASH_GAP_MS, FLASH_MS, flashVisible, planStorm, stormAllowed, stormGap } from "@/lib/house";

/** Storms over the house, counted in visible seconds. Each lightning strike flashes the room twice (unless reduced
 *  motion), sends thunder from the window, and offers line noise to a call in progress through onStrike. */
export function useStorm(o: { live: boolean; quiet: boolean; reduced: boolean; onStrike: () => void }) {
  const [heavy, setHeavy] = useState(false);
  const [lightning, setLightning] = useState(false);
  const opt = useRef(o); opt.current = o;
  const st = useRef({ until: stormGap(Math.random()), t: 0, plan: null as null | { length: number; flashes: number[] } });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
  const strike = useCallback(() => {
    const show = flashVisible(opt.current.reduced);
    if (show) { setLightning(true); later(FLASH_MS, () => setLightning(false)); later(FLASH_MS + FLASH_GAP_MS, () => setLightning(true)); later(FLASH_MS * 2 + FLASH_GAP_MS, () => setLightning(false)); }
    later(show ? 300 : 0, () => opt.current.onStrike());
    const far = Math.random() * 0.7; later(600 + far * 3500, () => audio.emit("thunder", far));
  }, []);
  const begin = useCallback(() => {
    const plan = planStorm(Math.random); st.current.plan = plan; st.current.t = 0;
    setHeavy(true); audio.emit("storm", true); later(2500, () => audio.emit("thunder", 0.95));
  }, []);
  const end = useCallback(() => { st.current.plan = null; st.current.until = stormGap(Math.random()); setHeavy(false); audio.emit("storm", false); later(4000, () => audio.emit("thunder", 1)); }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const s = st.current, ok = stormAllowed({ toysLive: opt.current.live, quiet: opt.current.quiet, visible: document.visibilityState === "visible" });
      if (s.plan) {
        if (opt.current.quiet) return end();
        if (document.visibilityState !== "visible") return;
        s.t++;
        if (s.plan.flashes.includes(s.t) && opt.current.live) strike();
        if (s.t >= s.plan.length) end();
        return;
      }
      if (!ok) return;
      if (--s.until <= 0) begin();
    }, 1000);
    const t = timers.current;
    return () => { clearInterval(id); t.forEach(clearTimeout); };
  }, [begin, end, strike]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __storm?: () => void; __strike?: () => void };
    w.__storm = () => { if (!st.current.plan && opt.current.live && !opt.current.quiet) begin(); };
    w.__strike = () => { if (st.current.plan) strike(); };
  }, [begin, strike]);
  return { heavy, lightning };
}
