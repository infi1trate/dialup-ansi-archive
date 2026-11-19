import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  muted: boolean; reduced: boolean; lamp: boolean;
  physical?: React.ReactNode;
  /** A link the board offered (postcards): Copy link, and Share where the Web Share API exists. */
  share?: string | null;
  /** Ten-second tape entries (list items inside the menu), when the browser can record. */
  tape?: React.ReactNode;
  onMute: () => void; onReduced: () => void; onLamp: () => void; onSkip: () => void;
}

/** The single piece of modern UI: a small, low-contrast corner control. */
export function EscapeHatch(p: Props) {
  const [open, setOpen] = useState(false);
  const act = (f: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => { f(); e.currentTarget.blur(); };
  return (
    <nav className={`hatch ${open ? "is-open" : ""}`} aria-label="Settings">
      {p.share && <ShareLink url={p.share} />}
      <Button variant="ghost" className="hatch-toggle hatch-lamp-direct" aria-label="Toggle desk lamp" aria-pressed={p.lamp} onClick={act(p.onLamp)}>☼</Button>
      {open && (
        <ul className="hatch-menu" onClick={(e) => { if ((e.target as HTMLElement).closest("[data-close]")) setOpen(false); }}>
          <li><Button variant="ghost" aria-pressed={p.lamp} onClick={act(p.onLamp)}>Lamp: {p.lamp ? "on" : "off"}</Button></li>
          {p.tape}
          {p.physical}
          <li><Button variant="ghost" type="button" aria-pressed={p.muted} onClick={act(p.onMute)}>{p.muted ? "Unmute" : "Mute"}</Button></li>
          <li><Button variant="ghost" type="button" onClick={act(p.onSkip)}>Skip to art</Button></li>
          <li><Button variant="ghost" type="button" aria-pressed={p.reduced} onClick={act(p.onReduced)}>Reduced motion: {p.reduced ? "on" : "off"}</Button></li>
          <li><Link to="/gallery">Plain gallery</Link></li>
          <li><Link to="/credits">Credits</Link></li>
        </ul>
      )}
      <Button variant="ghost" type="button" className="hatch-toggle" aria-expanded={open} aria-label={open ? "Close settings" : "Open settings"} onClick={act(() => setOpen(!open))}>
        <span aria-hidden>{open ? "×" : "···"}</span>
      </Button>
    </nav>
  );
}

function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy this link", url); } };
  return (
    <div className="hatch-share" role="group" aria-label="Postcard link">
      <Button variant="ghost" type="button" onClick={(e) => { void copy(); e.currentTarget.blur(); }}>{copied ? "Copied" : "Copy link"}</Button>
      {canShare && <Button variant="ghost" type="button" onClick={(e) => { void navigator.share({ url, title: "You have mail. 2400 baud." }).catch(() => {}); e.currentTarget.blur(); }}>Share</Button>}
    </div>
  );
}
