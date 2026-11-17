import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Monitor } from "./Monitor";
import { ContextBar } from "./ContextBar";
import type { KeyHint } from "@/bbs/io";
import { Room } from "@/components/room/Room";
import { EscapeHatch } from "@/components/room/EscapeHatch";
import { DEFAULTS, brightnessGain, contrastGain, loadRoom, saveRoom, type RoomSettings } from "@/components/room/settings";
import { audio } from "@/audio/bus";
import type { Machine } from "@/machine/machine";
import type { DeepLink } from "@/bbs/io";
// literal, not imported: the house pack (and the terminal it pulls in) must stay out of the first frame
const HOUSE_PACK = "crawl-01";

interface Props { deepLink?: DeepLink & { number: string } }

export const SKIP_TO_ART = `/dial/555-0142/1994/${HOUSE_PACK}/CRWL-LGO.ANS`;

/** The Kestrel 486 in its basement. All canvas/WebGL/audio/storage work starts in effects only. */
export function Computer({ deepLink }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const machine = useRef<Machine | null>(null);
  const navigate = useNavigate();
  const [powered, setPowered] = useState(false);
  const [tube, setTube] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [cfg, setCfg] = useState<RoomSettings>(DEFAULTS);
  const [osReduced, setOsReduced] = useState(false);
  const [leaned, setLeaned] = useState(false);
  /** null until the client knows: "room" on desktops, "tube" (bezel to bezel + touch keys) on phones. */
  const [layout, setLayout] = useState<"room" | "tube" | null>(null);
  const [hints, setHints] = useState<KeyHint[]>([]);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const reduced = cfg.reducedMotion ?? osReduced;

  const update = useCallback((patch: Partial<RoomSettings>) => {
    setCfg((c) => { const n = { ...c, ...patch }; saveRoom(n); return n; });
  }, []);

  // settings from storage, OS motion preference, initial lean
  useEffect(() => {
    const s = loadRoom();
    setCfg(s);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsReduced(mq.matches);
    const narrow = window.innerWidth < 900 || window.innerHeight > window.innerWidth;
    const touch = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 820;
    setLayout(touch || window.innerWidth < 640 ? "tube" : "room");
    setLeaned(s.lean ?? narrow);
    audio.setMix({ muted: s.muted, modemVolume: s.modemVolume });
    void import("@/data/net").then((n) => n.count("landed"));
  }, []);

  useEffect(() => {
    if (!layout) return;
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const [{ Engine }, { Machine }] = await Promise.all([import("@/machine/engine"), import("@/machine/machine")]);
      if (disposed || !canvas.current) return;
      const engine = new Engine(canvas.current);
      const m = new Machine(engine);
      machine.current = m;
      if (import.meta.env.DEV) (window as unknown as { __machine?: Machine }).__machine = m; // test hook, dev only
      const c = cfgRef.current;
      engine.crt.brightness = brightnessGain(c.brightness);
      engine.crt.contrast = contrastGain(c.contrast);
      const unsubs = [m.powered.subscribe(setPowered), m.tube.subscribe(setTube), m.turbo.subscribe(setTurbo), m.hints.subscribe(setHints)];
      const orient = () => m.setPortrait(window.innerHeight > window.innerWidth);
      orient();
      window.addEventListener("resize", orient);
      unsubs.push(() => window.removeEventListener("resize", orient));
      const down = (e: KeyboardEvent) => {
        if (e.key === "`" && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleLean(); return; }
        if ((e.target as HTMLElement)?.closest?.(".hatch")) return;
        m.handleKeyDown(e);
      };
      const up = (e: KeyboardEvent) => m.handleKeyUp(e);
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      if (deepLink) m.powerOn(deepLink);
      cleanup = () => { unsubs.forEach((u) => u()); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); m.powerOff(); engine.destroy(); };
    })();
    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // touch: tap a text row (lightbars, phone book), swipe to scroll finished art
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTubePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => { touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onTubePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = machine.current, st = touchStart.current; touchStart.current = null;
    if (!m || !st) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dy = e.clientY - st.y;
    const rows = m.engine.term.rows;
    if (Math.abs(dy) > 24) { // swipe: one line per ~row height dragged
      const n = Math.min(rows, Math.max(1, Math.round(Math.abs(dy) / (r.height / rows))));
      for (let i = 0; i < n; i++) m.pressHint({ label: "", key: dy > 0 ? "ArrowUp" : "ArrowDown" });
      return;
    }
    const row = Math.floor(((e.clientY - r.top) / r.height) * rows) + 1;
    m.tap(row);
  };

  useEffect(() => { if (machine.current) machine.current.engine.crt.reducedMotion = reduced; }, [reduced, powered]);

  const leanRef = useRef(leaned);
  leanRef.current = leaned;
  const lean = useCallback((v: boolean) => { setLeaned(v); update({ lean: v }); }, [update]);
  const toggleLean = () => lean(!leanRef.current);
  const getState = useCallback(() => machine.current?.state.value ?? "off", []);

  const toggleLamp = () => { audio.unlock(); audio.emit("lampToggle", !cfg.lamp); update({ lamp: !cfg.lamp }); };

  const monitor = (
    <Monitor
      ref={canvas}
      powered={tube}
      glass
      brightness={cfg.brightness}
      contrast={cfg.contrast}
      onPower={() => machine.current?.pressMonitorPower()}
      onBrightnessKnob={(v) => { update({ brightness: v }); if (machine.current) machine.current.engine.crt.brightness = brightnessGain(v); }}
      onContrastKnob={(v) => { update({ contrast: v }); if (machine.current) machine.current.engine.crt.contrast = contrastGain(v); }}
    >
      <div className="sticky-note" aria-label="Sticky note">
        <p>PWR ON.</p>
        <p>ENTER = dial.</p>
        <p>login: GUEST</p>
        <p>ENTER skips anything.</p>
        <p>I = who made it.</p>
      </div>
    </Monitor>
  );

  const hatch = (
      <EscapeHatch
      muted={cfg.muted}
      reduced={reduced}
      lamp={cfg.lamp}
      onMute={() => { const v = !cfg.muted; update({ muted: v }); audio.setMix({ muted: v }); }}
      onReduced={() => update({ reducedMotion: !reduced })}
      onLamp={toggleLamp}
      onSkip={() => { audio.unlock(); void navigate({ to: "/dial/$number/$year/$pack/$file", params: { number: "555-0142", year: "1994", pack: HOUSE_PACK, file: "CRWL-LGO.ANS" } }); }}
    />
  );

  if (!layout) return <main className="room" aria-busy="true"><h1 className="sr-only">Dial-Up: a 486 in a dark basement</h1></main>;

  if (layout === "tube") return (
    <main className={`tube-only ${reduced ? "reduce" : ""}`}>
      <h1 className="sr-only">Dial-Up: a 1992 PC calling The Crawlspace BBS</h1>
      <div className="tube-frame">
        <canvas ref={canvas} className="monitor-screen" aria-label="CRT screen" onPointerDown={onTubePointerDown} onPointerUp={onTubePointerUp} />
      </div>
      <ContextBar
        hints={hints} powered={powered}
        onPower={() => machine.current?.pressPcPower()}
        onKey={(h) => machine.current?.pressHint(h)}
        onText={(t) => machine.current?.typeText(t)}
      />
      {hatch}
    </main>
  );

  return (
    <Room
      monitor={monitor}
      powered={powered}
      turbo={turbo}
      lamp={cfg.lamp}
      leaned={leaned}
      reduced={reduced}
      modemVolume={cfg.modemVolume}
      getState={getState}
      onPcPower={() => machine.current?.pressPcPower()}
      onTurbo={() => machine.current?.toggleTurbo()}
      onLamp={toggleLamp}
      onModemVolume={(v) => { update({ modemVolume: v }); audio.setMix({ modemVolume: v }); }}
      onLean={lean}
    >
      {hatch}
    </Room>
  );
}
