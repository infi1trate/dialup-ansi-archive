import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Monitor } from "./Monitor";
import { Room } from "@/components/room/Room";
import { EscapeHatch } from "@/components/room/EscapeHatch";
import { DEFAULTS, brightnessGain, contrastGain, loadRoom, saveRoom, type RoomSettings } from "@/components/room/settings";
import { audio } from "@/audio/bus";
import type { Machine } from "@/machine/machine";
import type { DeepLink } from "@/bbs/io";
import { HOUSE_PACK } from "@/data/housepack";

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
    setLeaned(s.lean ?? narrow);
    audio.setMix({ muted: s.muted, modemVolume: s.modemVolume });
    void import("@/data/net").then((n) => n.count("landed"));
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const [{ Engine }, { Machine }] = await Promise.all([import("@/machine/engine"), import("@/machine/machine")]);
      if (disposed || !canvas.current) return;
      const engine = new Engine(canvas.current);
      const m = new Machine(engine);
      machine.current = m;
      const c = cfgRef.current;
      engine.crt.brightness = brightnessGain(c.brightness);
      engine.crt.contrast = contrastGain(c.contrast);
      const unsubs = [m.powered.subscribe(setPowered), m.tube.subscribe(setTube), m.turbo.subscribe(setTurbo)];
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
  }, []);

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
      <EscapeHatch
        muted={cfg.muted}
        reduced={reduced}
        lamp={cfg.lamp}
        onMute={() => { const v = !cfg.muted; update({ muted: v }); audio.setMix({ muted: v }); }}
        onReduced={() => update({ reducedMotion: !reduced })}
        onLamp={toggleLamp}
        onSkip={() => { audio.unlock(); void navigate({ to: "/dial/$number/$year/$pack/$file", params: { number: "555-0142", year: "1994", pack: HOUSE_PACK, file: "CRWL-LGO.ANS" } }); }}
      />
    </Room>
  );
}
