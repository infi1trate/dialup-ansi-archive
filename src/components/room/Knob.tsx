import { useEffect, useRef } from "react";
import { Button } from '@/components/ui/button';

interface Props { value: number; onChange: (v: number) => void; className?: string; label: string }

/** A physical knob: drag up/down or scroll. Value 0..1, sweeps 270 degrees. */
export function Knob({ value, onChange, className = "", label }: Props) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const set = (v: number) => onChange(Math.max(0, Math.min(1, v)));
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(()=>{const el=ref.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();e.stopPropagation();set(value-e.deltaY*.001);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[value,onChange]);
  return (
    <Button ref={ref} variant="ghost"
      type="button"
      tabIndex={-1}
      aria-label={label}
      data-touch
      className={`knob ${className}`}
      style={{ ["--rot" as string]: `${-135 + value * 270}deg` }}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; }}
      onPointerMove={(e) => { if (drag.current) set(drag.current.v + (drag.current.y - e.clientY) / 120); }}
      onPointerUp={() => { drag.current = null; }}
      onKeyDown={(e) => e.preventDefault()}
    />
  );
}
