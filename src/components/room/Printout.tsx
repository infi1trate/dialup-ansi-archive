import { useEffect, useState } from "react";
import { audio } from "@/audio/bus";

export interface PrintJob { url: string; blob: Blob; name: string; id: number }
/** The tractor-feed sheet rising from the printer under the desk, at the right of the keyboard. Click it to tear it off (save). */
export function Printout({ job, lamp, reduced, skip, onSave, onRisen, onGone }: { job: PrintJob; lamp: boolean; reduced: boolean; skip: number; onSave: () => void; onRisen: () => void; onGone: () => void }) {
  const [phase, setPhase] = useState<"rising" | "up" | "falling">(reduced ? "up" : "rising");
  useEffect(() => { if (skip) setPhase((p) => (p === "rising" ? "up" : p)); }, [skip]);
  useEffect(() => { if (phase !== "rising") onRisen(); }, [phase, onRisen]);
  useEffect(() => { if (phase !== "falling") return; const t = setTimeout(onGone, reduced ? 0 : 520); return () => clearTimeout(t); }, [phase, reduced, onGone]);
  useEffect(() => { const away = () => setPhase("falling"); window.addEventListener("dialup:printout-away", away); return () => window.removeEventListener("dialup:printout-away", away); }, []);
  return <button type="button" data-touch className={`printout is-${phase}`} aria-label="Printout: tear it off and save it" style={{ "--paper-light": lamp ? 1 : 0.38 } as React.CSSProperties}
    onAnimationEnd={() => setPhase((p) => (p === "rising" ? "up" : p))}
    onClick={(e) => { e.stopPropagation(); if (phase === "rising") { setPhase("up"); audio.emit("printScreen", 0); return; } onSave(); setPhase("falling"); }}>
    <img src={job.url} alt="" draggable={false} />
  </button>;
}
