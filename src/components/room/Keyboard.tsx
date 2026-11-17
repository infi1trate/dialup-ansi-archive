import { KEYBOARD } from "./layout";

const ROWS: number[][] = [
  [1, 0.5, 1, 1, 1, 1, 0.4, 1, 1, 1, 1, 0.4, 1, 1, 1, 1, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 1],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 1],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 1],
];

/** The clacky beige keyboard at the front of frame (mostly cropped). Purely decorative. */
export function Keyboard() {
  return (
    <div className="keyboard" style={{ left: `${KEYBOARD.x}cqw`, top: `${KEYBOARD.y}cqw`, width: `${KEYBOARD.w}cqw`, height: `${KEYBOARD.h}cqw` }} aria-hidden>
      <div className="keyboard-plate">
        {ROWS.map((row, r) => (
          <div className="kb-row" key={r} style={{ marginBottom: r === 0 ? "3%" : undefined }}>
            {row.map((w, i) => (w === 0.5 || w === 0.4) ? <span key={i} style={{ flex: w }} className="kb-gap" /> : <span key={i} style={{ flex: w }} className={r === 0 && i === 0 ? "kb-key kb-dark" : "kb-key"} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
