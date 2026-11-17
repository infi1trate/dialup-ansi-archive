import { forwardRef, useState, type ReactNode } from "react";

interface MonitorProps {
  powered: boolean;
  onPower: () => void;
  onBrightness?: (v: number) => void;
  children?: ReactNode;
}

/**
 * The KESTREL VGA monitor: a self-contained physical object. The screen rect is the
 * canvas element (4:3); a room scene can be placed around this component later.
 */
export const Monitor = forwardRef<HTMLCanvasElement, MonitorProps>(function Monitor({ powered, onPower, onBrightness, children }, ref) {
  const [bright, setBright] = useState(4);
  const turn = (d: number) => {
    const v = Math.max(0, Math.min(6, bright + d));
    setBright(v);
    onBrightness?.(0.55 + v * 0.075);
  };
  return (
    <div className="monitor-case">
      <div className="monitor-bezel">
        <div className="monitor-tube">
          <canvas ref={ref} className="monitor-screen" aria-label="CRT screen" />
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
          <button
            type="button"
            className="monitor-knob"
            aria-label="Brightness knob"
            style={{ transform: `rotate(${(bright - 3) * 40}deg)` }}
            onClick={(e) => turn(e.shiftKey ? -1 : 1)}
            onContextMenu={(e) => { e.preventDefault(); turn(-1); }}
            onWheel={(e) => turn(e.deltaY < 0 ? 1 : -1)}
          />
          <span className={powered ? "monitor-led monitor-led-on" : "monitor-led"} aria-hidden />
          <button type="button" className="monitor-power" aria-label={powered ? "Power off" : "Power on"} aria-pressed={powered} onClick={onPower} />
        </div>
      </div>
      {children}
    </div>
  );
});
