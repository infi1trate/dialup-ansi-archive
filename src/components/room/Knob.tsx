import { useRef } from "react";

interface Props { value: number; onChange: (v: number) => void; className?: string; label: string }

/** A physical knob: drag up/down or scroll. Value 0..1, sweeps 270 degrees. */
export function Knob({ value, onChange, className = "", label }: Props) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const set = (v: number) => onChange(Math.max(0, Math.min(1, v)));
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      data-touch
      className={`knob ${className}`}
      style={{ ["--rot" as string]: `${-135 + value * 270}deg` }}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; }}
      onPointerMove={(e) => { if (drag.current) set(drag.current.v + (drag.current.y - e.clientY) / 120); }}
      onPointerUp={() => { drag.current = null; }}
      onWheel={(e) => set(value + (e.deltaY < 0 ? 0.06 : -0.06))}
      onKeyDown={(e) => e.preventDefault()}
    />
  );
}
