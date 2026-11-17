import { useState } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  muted: boolean; reduced: boolean; lamp: boolean;
  onMute: () => void; onReduced: () => void; onLamp: () => void; onSkip: () => void;
}

/** The single piece of modern UI: a small, low-contrast corner control. */
export function EscapeHatch(p: Props) {
  const [open, setOpen] = useState(false);
  const act = (f: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { f(); e.currentTarget.blur(); };
  return (
    <nav className={`hatch ${open ? "is-open" : ""}`} aria-label="Settings">
      {open && (
        <ul className="hatch-menu">
          <li><button type="button" aria-pressed={p.muted} onClick={act(p.onMute)}>{p.muted ? "Unmute" : "Mute"}</button></li>
          <li><button type="button" onClick={act(p.onSkip)}>Skip to art</button></li>
          <li><button type="button" aria-pressed={p.reduced} onClick={act(p.onReduced)}>Reduced motion: {p.reduced ? "on" : "off"}</button></li>
          <li><button type="button" aria-pressed={p.lamp} onClick={act(p.onLamp)}>Lamp: {p.lamp ? "on" : "off"}</button></li>
          <li><Link to="/credits">Credits</Link></li>
        </ul>
      )}
      <button type="button" className="hatch-toggle" aria-expanded={open} aria-label={open ? "Close settings" : "Open settings"} onClick={act(() => setOpen(!open))}>
        <span aria-hidden>{open ? "×" : "···"}</span>
      </button>
    </nav>
  );
}
