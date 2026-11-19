import { printGeometry } from "@/lib/photo";

export interface PhotoJob { printUrl: string; png: Blob | null; name: string; id: number; printW: number }
/** The fresh instant print, developing from pale grey-green to full colour. Tap the print to keep it (save); tap outside to put it down. */
export function PhotoCloseup({ job, lamp, onSave, onClose }: { job: PhotoJob; lamp: boolean; onSave: () => void; onClose: () => void }) {
  const g = printGeometry(job.printW);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return <div className="note-closeup photo-closeup" data-touch onClick={onClose}>
    <button type="button" className="print-enlarged" aria-label="Instant photo: keep it" style={{ "--paper-light": lamp ? 1 : 0.42 } as React.CSSProperties} onClick={(e) => { e.stopPropagation(); onSave(); onClose(); }}>
      <img src={job.printUrl} alt="An instant photo of the computer on the desk" draggable={false} />
      <span key={job.id} className="print-develop" aria-hidden style={{ left: pct(g.side, g.w), top: pct(g.top, g.h), width: pct(g.image, g.w), height: pct(g.image, g.h) }} />
    </button>
  </div>;
}
