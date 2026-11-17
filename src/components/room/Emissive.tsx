import { useEffect, useState } from "react";
import { CASE, CASE_PARTS, CLOCK, MODEM, MODEM_LEDS, MODEM_LED_Y, inBox, modemLedX } from "./layout";
import { SevenSeg } from "./SevenSeg";
import { speedDisplay } from "@/audio/tables";

const at = (p: { x: number; y: number }) => ({ left: `${p.x}cqw`, top: `${p.y}cqw` });

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

/** Everything that glows on its own: drawn above the light map so darkness never dims it. */
export function Emissive({ powered, turbo }: { powered: boolean; turbo: boolean }) {
  const now = useClock();
  const h = now ? now.getHours() % 12 || 12 : 12, m = now ? now.getMinutes() : 0;
  const pm = now ? now.getHours() >= 12 : false;
  const time = `${String(h).padStart(2, " ")}:${String(m).padStart(2, "0")}`;
  const disp = inBox(CASE, CASE_PARTS.display.x, CASE_PARTS.display.y);
  return (
    <>
      <span data-led="pwr" className={`led led-green ${powered ? "is-on" : "is-standby"}`} style={at(inBox(CASE, CASE_PARTS.powerLed.x, CASE_PARTS.powerLed.y))} />
      <span data-led="hdd" className="led led-amber" style={at(inBox(CASE, CASE_PARTS.hddLed.x, CASE_PARTS.hddLed.y))} />
      <span className={`pc-speed ${powered ? "is-on" : ""}`} style={{ ...at(disp), width: `${(CASE.w * CASE_PARTS.display.w) / 100}cqw`, height: `${(CASE.h * CASE_PARTS.display.h) / 100}cqw` }}>
        <SevenSeg value={powered ? speedDisplay(turbo) : "  "} className="seg-red" />
      </span>
      {MODEM_LEDS.map((l, i) => <span key={l} data-led={l} className="led led-red led-modem" style={at(inBox(MODEM, modemLedX(i), MODEM_LED_Y))} />)}
      <span className="clock-face" style={{ left: `${CLOCK.x + CLOCK.w * 0.16}cqw`, top: `${CLOCK.y + CLOCK.h * 0.2}cqw`, width: `${CLOCK.w * 0.68}cqw`, height: `${CLOCK.h * 0.5}cqw` }}>
        <SevenSeg value={time} className="seg-red seg-clock" />
        <i className={pm ? "clock-pm is-on" : "clock-pm"} />
      </span>
    </>
  );
}
