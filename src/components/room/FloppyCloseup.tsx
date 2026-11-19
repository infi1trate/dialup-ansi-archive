import floppyPhoto from "@/assets/plates/floppy-disks-closeup.webp.asset.json";
import { DISK_IDS, DISK_LABELS, type DiskId } from "@/machine/floppy-state";
import { fractionStyle, type Box as Fraction } from "./plate-layout";

/** Fractions of the 1280x720 close-up photograph. */
export const FLOPPY_DISKS: Record<DiskId, Fraction> = { 1: [.0215,.2639,.2305,.4271], 2: [.2705,.2639,.2227,.4271], 3: [.5117,.2639,.2227,.4271], 4: [.7529,.2639,.2256,.4271] };
export const FLOPPY_LABELS: Record<DiskId, Fraction> = { 1: [.0488,.283,.1758,.2257], 2: [.2949,.283,.1738,.2257], 3: [.5361,.283,.1738,.2257], 4: [.7793,.283,.1738,.2257] };
const SLANT: Record<DiskId, number> = { 1: -2, 2: 1.2, 3: -0.8, 4: 2 };
const NAMES: Record<DiskId, string> = { 1: "black", 2: "blue", 3: "beige", 4: "red" };

/** Close-up of the four floppies by the PC, lit like the room; clicking one inserts it. */
export function FloppyCloseup({ lamp, onPick, onClose }: { lamp: boolean; onPick: (d: DiskId) => void; onClose: () => void }) {
  return <div className="note-closeup floppy-closeup" data-touch onClick={onClose}>
    <div className={`floppy-photo ${lamp ? "" : "is-dark"}`} onClick={(e) => e.stopPropagation()}>
      <img src={floppyPhoto.url} alt="Four floppy disks on the desk" draggable={false} />
      {DISK_IDS.map((d) => <div key={`l${d}`} className="floppy-label" aria-hidden style={{ ...fractionStyle(FLOPPY_LABELS[d]), transform: `rotate(${SLANT[d]}deg)` }}>{DISK_LABELS[d].map((l) => <span key={l}>{l}</span>)}</div>)}
      {DISK_IDS.map((d) => <button key={d} type="button" className="plate-hotspot floppy-disk" aria-label={`Insert the ${NAMES[d]} disk labelled ${DISK_LABELS[d].join(" ")}`} style={fractionStyle(FLOPPY_DISKS[d])} onClick={() => onPick(d)} />)}
    </div>
  </div>;
}
