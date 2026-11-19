import { forwardRef, useState, type ReactNode } from "react";
import { Knob } from "@/components/room/Knob";

interface MonitorProps {
  onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>;
  powered: boolean;
  onPower: () => void;
  /** CRT brightness multiplier. */
  onBrightness?: (v: number) => void;
  onContrast?: (v: number) => void;
  brightness?: number; // knob 0..1
  contrast?: number; // knob 0..1
  onBrightnessKnob?: (v: number) => void;
  onContrastKnob?: (v: number) => void;
  /** Glass reflection + dust over the tube (room scene only). */
  glass?: boolean;
  children?: ReactNode;
}

const noFocus = (e: React.MouseEvent) => e.preventDefault();

/**
 * The KESTREL VGA monitor: a self-contained physical object. The screen rect is the
 * canvas element (4:3). Knobs are controlled when brightness/contrast props are given.
 */
export const Monitor = forwardRef<HTMLCanvasElement, MonitorProps>(function Monitor(p, ref) {
  const [localB, setLocalB] = useState(0.6);
  const [localC, setLocalC] = useState(0.7);
  const b = p.brightness ?? localB, c = p.contrast ?? localC;
  const setB = (v: number) => { setLocalB(v); p.onBrightnessKnob?.(v); p.onBrightness?.(0.6 + v * 0.65); };
  const setC = (v: number) => { setLocalC(v); p.onContrastKnob?.(v); p.onContrast?.(0.7 + v * 0.55); };
  if (p.glass) return <div className="photo-monitor">
    <canvas ref={ref} className="monitor-screen" aria-label="CRT screen" onPointerDown={p.onPointerDown} onPointerUp={p.onPointerUp} />
  </div>;
  return (
    <div className="monitor-case">
      <span className="monitor-screw monitor-screw-l" aria-hidden />
      <span className="monitor-screw monitor-screw-r" aria-hidden />
      <div className="monitor-bezel">
        <div className="monitor-tube">
          <canvas ref={ref} className="monitor-screen" aria-label="CRT screen" onPointerDown={p.onPointerDown} onPointerUp={p.onPointerUp} />
          {p.glass && <div className="monitor-glass" aria-hidden />}
        </div>
      </div>
      <div className="monitor-chin">
        <div className="monitor-plate">
          <span className="monitor-brand">KESTREL</span>
          <span className="monitor-model">VGA</span>
        </div>
        <div className="monitor-vents" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => <span key={i} />)}
        </div>
        <div className="monitor-controls">
          <Knob label="Contrast knob" value={c} onChange={setC} className="monitor-knob" />
          <Knob label="Brightness knob" value={b} onChange={setB} className="monitor-knob" />
          <span className={p.powered ? "monitor-led monitor-led-on" : "monitor-led"} aria-hidden />
          <button type="button" tabIndex={-1} data-touch className="monitor-power" aria-label={p.powered ? "Monitor off" : "Monitor on"} aria-pressed={p.powered} onMouseDown={noFocus} onClick={p.onPower} />
        </div>
      </div>
      {p.children}
    </div>
  );
});
