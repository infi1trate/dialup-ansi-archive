import { MODEM, MODEM_LEDS, MODEM_LED_Y, modemLedX } from "./layout";
import { Knob } from "./Knob";

/** CORVID 14.4 external modem. Its LEDs are drawn in the emissive layer. */
export function Modem({ volume, onVolume }: { volume: number; onVolume: (v: number) => void }) {
  return (
    <div className="modem" style={{ left: `${MODEM.x}cqw`, top: `${MODEM.y}cqw`, width: `${MODEM.w}cqw`, height: `${MODEM.h}cqw` }}>
      <div className="modem-top" aria-hidden />
      <div className="modem-brand" aria-hidden>CORVID <span>14.4</span></div>
      {MODEM_LEDS.map((l, i) => (
        <span key={l} className="modem-led-well" style={{ left: `${modemLedX(i)}%`, top: `${MODEM_LED_Y}%` }} aria-hidden>
          <span className="modem-led-label">{l}</span>
        </span>
      ))}
      <Knob label="Modem volume knob" value={volume} onChange={onVolume} className="modem-knob" />
      <div className="modem-shadow" aria-hidden />
    </div>
  );
}
