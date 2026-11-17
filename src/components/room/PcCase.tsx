import { CASE, CASE_PARTS } from "./layout";

const pos = (p: { x: number; y: number; w?: number; h?: number }) => ({ left: `${p.x}%`, top: `${p.y}%`, width: p.w ? `${p.w}%` : undefined, height: p.h ? `${p.h}%` : undefined });
const noFocus = (e: React.MouseEvent) => e.preventDefault();

/** The beige KESTREL 486DX-33 desktop case. LEDs and the speed display live in the emissive layer. */
export function PcCase({ powered, turbo, onPower, onTurbo }: { powered: boolean; turbo: boolean; onPower: () => void; onTurbo: () => void }) {
  return (
    <div className="pc-case" style={{ left: `${CASE.x}cqw`, top: `${CASE.y}cqw`, width: `${CASE.w}cqw`, height: `${CASE.h}cqw` }}>
      <div className="pc-seam" aria-hidden />
      <span className="pc-screw" style={{ left: "1%", top: "10%" }} aria-hidden />
      <span className="pc-screw" style={{ right: "1%", top: "10%" }} aria-hidden />
      <div className="pc-badge" aria-hidden><b>KESTREL</b> 486DX-33</div>
      <div className="pc-vents" aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} />)}</div>
      <div className="pc-display-well" style={pos(CASE_PARTS.display)} aria-hidden />
      <span className="pc-led-label" style={{ left: "31.6%", top: "86%" }} aria-hidden>PWR&nbsp;&nbsp;HDD</span>
      <button type="button" tabIndex={-1} data-touch aria-label="Turbo button" aria-pressed={turbo} className="pc-button pc-turbo" style={pos(CASE_PARTS.turbo)} onMouseDown={noFocus} onClick={onTurbo} />
      <span className="pc-btn-label" style={{ left: "45.4%", top: "24%" }} aria-hidden>TURBO</span>
      <span className="pc-button pc-reset" style={pos(CASE_PARTS.reset)} aria-hidden />
      <span className="pc-btn-label" style={{ left: "45.4%", top: "58%" }} aria-hidden>RESET</span>
      <div className="pc-bay pc-bay-525" aria-hidden><span className="pc-bay-slot" /><span className="pc-bay-lever" /></div>
      <div className="pc-bay pc-bay-35" aria-hidden><span className="pc-bay-slot" /><span className="pc-bay-eject" /></div>
      <button type="button" tabIndex={-1} data-touch aria-label={powered ? "PC power off" : "PC power on"} aria-pressed={powered} className="pc-rocker" style={pos(CASE_PARTS.rocker)} onMouseDown={noFocus} onClick={onPower}>
        <span className="pc-rocker-face" />
      </button>
      <div className="pc-shadow" aria-hidden />
    </div>
  );
}
