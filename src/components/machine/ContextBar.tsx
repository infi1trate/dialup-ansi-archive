import { useEffect, useRef } from "react";
import type { KeyHint } from "@/bbs/io";

interface Props {
  hints: KeyHint[];
  powered: boolean;
  onPower: () => void;
  onKey: (h: KeyHint) => void;
  onText: (s: string) => void;
}

const tick = () => { try { navigator.vibrate?.(8); } catch { /* no haptics */ } };

/**
 * Touch context bar under the tube: only the keys the current screen accepts, as beige keycaps.
 * The list arrives out of band from the program on screen (never through the byte stream).
 */
export function ContextBar({ hints, powered, onPower, onKey, onText }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const wantsText = hints.some((h) => h.text);
  // a text prompt summons the phone's own keyboard
  useEffect(() => { if (wantsText) input.current?.focus({ preventScroll: true }); else input.current?.blur(); }, [wantsText]);
  const press = (h: KeyHint) => (e: React.PointerEvent) => {
    e.preventDefault(); tick();
    if (h.text) { input.current?.focus({ preventScroll: true }); return; }
    onKey(h);
  };
  return (
    <div className="ctxbar" role="toolbar" aria-label="Keys for this screen">
      {!powered ? (
        <button type="button" className="keycap keycap-power" onPointerDown={(e) => { e.preventDefault(); tick(); onPower(); }}>POWER</button>
      ) : hints.map((h, i) => (
        <button type="button" key={`${h.label}-${i}`} className={`keycap ${h.label.length > 6 ? "keycap-wide" : ""}`} onPointerDown={press(h)}>{h.text ? "⌨ type" : h.label}</button>
      ))}
      <input
        ref={input} className="ctx-input" aria-label="Type to the computer" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send"
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onKey({ label: "ENTER", key: "Enter" }); }
          else if (e.key === "Backspace" && !e.currentTarget.value) { e.preventDefault(); onKey({ label: "BS", key: "Backspace" }); }
          e.stopPropagation();
        }}
        onInput={(e) => { const v = e.currentTarget.value; if (v) { onText(v); tick(); } e.currentTarget.value = ""; }}
      />
    </div>
  );
}
