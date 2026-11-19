import { useEffect, useState } from "react";
import { IN_CALL_STATES, SITE_SECONDS_KEY, toysLive } from "@/lib/toys";
import { loadProfile } from "@/machine/storage";

/** Room toys wake up after one finished call or three visible minutes on the site (never during a first call). */
export function useToys(getState: () => string) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let seconds = Number(localStorage.getItem(SITE_SECONDS_KEY)) || 0, tick = 0;
    const check = () => {
      const calls = loadProfile().calls, inCall = IN_CALL_STATES.includes(getState());
      const v = toysLive({ calls, siteSeconds: seconds, inCall });
      setLive(v);
      if (import.meta.env.DEV) (window as unknown as { __toys?: unknown }).__toys = { live: v, calls, seconds, inCall }; // test hook, dev only
    };
    check();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") { seconds++; if (++tick % 5 === 0) { try { localStorage.setItem(SITE_SECONDS_KEY, String(seconds)); } catch { /* blocked */ } } }
      check();
    }, 1000);
    return () => clearInterval(iv);
  }, [getState]);
  return live;
}
