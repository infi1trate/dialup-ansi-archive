import { SPEAKER_L, SPEAKER_R } from "./layout";
import { Knob } from "./Knob";

const box = (b: { x: number; y: number; w: number; h: number }) => ({ left: `${b.x}cqw`, top: `${b.y}cqw`, width: `${b.w}cqw`, height: `${b.h}cqw` });

/** A pair of small beige desktop speakers flanking the monitor. The right one has the volume knob; the left one the power LED (emissive layer). */
export function Speakers({ volume, onVolume }: { volume: number; onVolume: (v: number) => void }) {
  return (
    <>
      <div className="speaker speaker-l" style={box(SPEAKER_L)} aria-hidden>
        <div className="speaker-grille" />
        <div className="speaker-badge">KESTREL<span>SOUND</span></div>
        <div className="speaker-shadow" />
      </div>
      <div className="speaker speaker-r" style={box(SPEAKER_R)}>
        <div className="speaker-grille" aria-hidden />
        <Knob label="Speaker volume knob" value={volume} onChange={onVolume} className="speaker-knob" />
        <div className="speaker-shadow" aria-hidden />
      </div>
    </>
  );
}
