import { Knob } from "@/components/room/Knob";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Monitor } from "./Monitor";

import { ContextBar } from "./ContextBar";
import type { KeyHint } from "@/bbs/io";
import { Room } from "@/components/room/Room";
import { EscapeHatch } from "@/components/room/EscapeHatch";
import { FloppyCloseup } from "@/components/room/FloppyCloseup";
import { useToys } from "@/components/room/useToys";
import { Printout, type PrintJob } from "@/components/room/Printout";
import { captureScreen } from "@/lib/printscreen";
import { deliverFile } from "@/lib/deliver";
import { currentBoardName } from "@/machine/signals";
import { loadFloppy, saveFloppy, type DiskId } from "@/machine/floppy-state";
import { floppyDisk } from "@/machine/signals";
import { DEFAULTS, brightnessGain, contrastGain, loadRoom, saveRoom, type RoomSettings } from "@/components/room/settings";
import { audio } from "@/audio/bus";
import type { Machine } from "@/machine/machine";
import type { TapeResult } from "@/machine/tape-recorder";
import type { TapeDeck } from "@/lib/tape";
import { tapeArmRequest, tapeState } from "@/machine/signals";
import type { DeepLink } from "@/bbs/io";
// literal, not imported: the house pack (and the terminal it pulls in) must stay out of the first frame
const HOUSE_PACK = "dc-01";

import type { Postcard } from "@/lib/postcard";
import { fractionStyle, GLASS } from "@/components/room/plate-layout";
type PostcardProp = { card: Postcard & { id: string }; number: string } | { missing: string };
interface Props { postcard?: PostcardProp; deepLink?: DeepLink & { number: string }; /** a wrong URL: dial it, get NO CARRIER, land at DOS */ lost?: string }

export const SKIP_TO_ART = `/dial/555-0142/1994/${HOUSE_PACK}/DC-LOGO.ANS`;

/** The Kestrel 486 in its basement. All canvas/WebGL/audio/storage work starts in effects only. */
export function Computer({ deepLink, lost, postcard }: Props) {
  const pendingCard = postcard && "card" in postcard ? postcard : null;
  const [cardWaiting, setCardWaiting] = useState(!!pendingCard);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [tape, setTape] = useState<"idle" | "armed" | "rec">("idle");
  const [tapeOk, setTapeOk] = useState(false);
  const [tapeNote, setTapeNote] = useState<string | null>(null);
  const [tapeFile, setTapeFile] = useState<TapeResult | null>(null);
  const deck = useRef<TapeDeck | null>(null);
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
    const touch = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 820;
    setLayout(touch || window.innerWidth < 640 || window.innerHeight>window.innerWidth ? "tube" : "room");
    setLeaned(pendingCard ? true : s.lean ?? false);
    if (pendingCard) setCfg({ ...s, lamp: false }); // the card arrives in the dark; not saved
    audio.setMix({ muted: s.muted, modemVolume: s.modemVolume, musicVolume: s.musicVolume });
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
      if (c.turbo) m.toggleTurbo(); // the turbo button stays where you left it
      const unsubs = [m.powered.subscribe(setPowered), m.tube.subscribe(setTube), m.turbo.subscribe((t) => { setTurbo(t); if (t !== cfgRef.current.turbo) update({ turbo: t }); }), m.hints.subscribe(setHints), m.shareUrl.subscribe(setShareUrl), m.exitHome.subscribe((v) => { if (v) void navigate({ to: "/" }); })];
      const { createTape, tapeSupported, saveTape } = await import("@/machine/tape-recorder");
      if (disposed) return;
      const touchy = window.matchMedia("(pointer: coarse)").matches;
      if (tapeSupported()) {
        const t = createTape(engine, () => document.querySelector<HTMLElement>(".photo-room"), {
          onNote: setTapeNote,
          onResult: (r) => {
            setTapeFile(r);
            if (import.meta.env.DEV) (window as unknown as { __tape?: unknown }).__tape = { size: r.size, duration: r.duration, mime: r.mime, hasAudio: r.hasAudio, name: r.name, blob: r.blob }; // test hook, dev only
            if (!touchy) void saveTape(r, false);
            void import("@/data/net").then((n) => n.count("tape_recorded"));
          },
        });
        deck.current = t.deck; setTapeOk(true);
        unsubs.push(t.destroy, tapeState.subscribe(setTape), tapeArmRequest.subscribe(() => { if (t.deck.state === "armed") t.deck.disarm(); else t.deck.arm(); }));
      }
      const orient = () => m.setPortrait(window.innerHeight > window.innerWidth);
      orient();
      window.addEventListener("resize", orient);
      unsubs.push(() => window.removeEventListener("resize", orient));
      let printDownAt = 0;
      const down = (e: KeyboardEvent) => {
        if (e.key === "`" && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleLean(); return; }
        if (e.key === "PrintScreen") { e.preventDefault(); printDownAt = Date.now(); void printRef.current(); return; }
        if (printUp.current && printSkipOpen.current) { printSkipOpen.current = false; skipRef.current(); e.preventDefault(); return; } // any key finishes the printout
        if (e.key === "F9") { e.preventDefault(); if (!e.repeat) { if (deck.current?.state === "rec") deck.current.finish(); else deck.current?.record(); } return; } // F9 records ten seconds, F9 again stops
        if (e.key === "Escape" && deck.current?.state === "rec") { e.preventDefault(); deck.current.finish(); return; }
        if ((e.target as HTMLElement)?.closest?.(".hatch")) return;
        m.handleKeyDown(e);
      };
      const up = (e: KeyboardEvent) => { if (e.key === "PrintScreen") { e.preventDefault(); if (Date.now() - printDownAt > 800) void printRef.current(); return; } // Windows only sends keyup for Print Screen
        if (e.key === "F9") { e.preventDefault(); return; } m.handleKeyUp(e); };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      if (postcard && "missing" in postcard) { m.lostAt = "POSTCARD"; m.lostNote = postcard.missing === "withdrawn" ? "This card was withdrawn." : "That postcard has expired, or was never sent."; m.powerOn(); }
      else if (deepLink) m.powerOn(deepLink);
      else if (lost) { m.lostAt = lost; m.powerOn(); }
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

  const pickUp = useCallback(() => {
    if (!pendingCard || !cardWaiting) return;
    const m = machine.current; if (!m) return;
    audio.unlock(); setCardWaiting(false); m.openPostcard(pendingCard);
  }, [pendingCard, cardWaiting]);
  useEffect(() => {
    if (!cardWaiting) return;
    const go = (e: Event) => { if ((e.target as HTMLElement)?.closest?.(".hatch") || !machine.current) return; e.preventDefault(); e.stopPropagation(); pickUp(); };
    window.addEventListener("keydown", go, { capture: true }); window.addEventListener("pointerdown", go);
    return () => { window.removeEventListener("keydown", go, { capture: true }); window.removeEventListener("pointerdown", go); };
  }, [cardWaiting, pickUp]);
  const reportCard = async () => { if (!pendingCard || reported) return; const { net } = await import("@/data/net"); await net("postcardReport", { id: pendingCard.card.id }); setReported(true); };

  const saveTapeFile = async (r: TapeResult) => { const { saveTape } = await import("@/machine/tape-recorder"); await saveTape(r, window.matchMedia("(pointer: coarse)").matches); };
  const toys = useToys(getState);
  const [floppy, setFloppyState] = useState<DiskId | null>(null);
  const [floppyOpen, setFloppyOpen] = useState(false);
  useEffect(() => { const d = loadFloppy(); setFloppyState(d); floppyDisk.set(d); }, []);
  const setFloppy = useCallback((d: DiskId | null) => {
    audio.unlock(); setFloppyOpen(false); setFloppyState(d); floppyDisk.set(d); saveFloppy(d);
    if (!d) { audio.emit("floppyEject"); return; }
    audio.emit("floppyInsert");
    if (machine.current?.powered.value) [250, 620, 980, 1320].forEach((t) => setTimeout(() => audio.emit("floppySeek"), t)); // the drive reads the new disk: ~1.5 s grind, LED blinking
  }, []);
  const floppySlot = useCallback(() => { if (floppyDisk.value) setFloppy(null); else { audio.unlock(); setFloppyOpen(true); } }, [setFloppy]);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const toysRef = useRef(toys); toysRef.current = toys;
  const printSkipOpen = useRef(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [printSkip, setPrintSkip] = useState(0);
  const printing = useRef(false);
  /** PRINT SCREEN: snapshot the CRT now (never mid-stream bytes later), then print it on the dot-matrix under the desk. */
  const printScreen = useCallback(async () => {
    const m = machine.current; if (!m || !m.powered.value || printing.current || !toysRef.current) return;
    audio.unlock();
    const shot = captureScreen(m.engine.term), board = currentBoardName.value;
    printing.current = true;
    try {
      const { printScreen: render } = await import("@/machine/screen-print");
      const { blob, name } = await render(shot, board);
      setPrintJob((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), blob, name, id: Date.now() }; });
      setPrintSkip(0); printSkipOpen.current = !reducedRef.current;
      audio.emit("printScreen", reducedRef.current ? 1.2 : 4);
      setTimeout(() => { printing.current = false; }, 400);
      void import("@/data/net").then((n) => n.count("screen_printed")).catch(() => {});
    } catch { printing.current = false; }
  }, []);
  const printRef = useRef(printScreen); printRef.current = printScreen;
  const printUp = useRef(false); printUp.current = !!printJob;
  const skipPrint = useCallback(() => { setPrintSkip((n) => n + 1); audio.emit("printScreen", 0); }, []);
  const skipRef = useRef(skipPrint); skipRef.current = skipPrint;
  const savePrint = useCallback(() => { if (printJob) void deliverFile(printJob.blob, printJob.name, "Dial-Up printout"); }, [printJob]);
  const dropPrint = useCallback(() => setPrintJob((old) => { if (old) URL.revokeObjectURL(old.url); return null; }), []);
  const toggleLamp = () => { audio.unlock(); audio.emit("lampToggle", !cfg.lamp); update({ lamp: !cfg.lamp }); };

  const monitor = (
    <Monitor
      ref={canvas}
      powered={tube}
      onPointerDown={layout==="tube"?onTubePointerDown:undefined}
      onPointerUp={layout==="tube"?onTubePointerUp:undefined}
      glass
      brightness={cfg.brightness}
      contrast={cfg.contrast}
      onPower={() => machine.current?.pressMonitorPower()}
      onBrightnessKnob={(v) => { update({ brightness: v }); if (machine.current) machine.current.engine.crt.brightness = brightnessGain(v); }}
      onContrastKnob={(v) => { update({ contrast: v }); if (machine.current) machine.current.engine.crt.contrast = contrastGain(v); }}
    >
    </Monitor>
  );

  const hatch = (
      <EscapeHatch
      share={shareUrl}
      tape={tapeOk ? <>
        {tape === "rec"
          ? <li><Button variant="ghost" type="button" onClick={(e) => { deck.current?.finish(); e.currentTarget.blur(); }}>Stop recording</Button></li>
          : <li><Button variant="ghost" type="button" onClick={(e) => { audio.unlock(); deck.current?.record(); e.currentTarget.blur(); }}>Record 10 seconds</Button></li>}
        {tape !== "rec" && <li><Button variant="ghost" type="button" aria-pressed={tape === "armed"} onClick={(e) => { audio.unlock(); if (deck.current?.state === "armed") deck.current.disarm(); else deck.current?.arm(); e.currentTarget.blur(); }}>{tape === "armed" ? "Record the next dial: armed" : "Record the next dial"}</Button></li>}
        {tapeFile && tape !== "rec" && <li><Button variant="ghost" type="button" onClick={(e) => { void saveTapeFile(tapeFile); e.currentTarget.blur(); }}>Save tape</Button></li>}
        {tapeNote && <li className="hatch-note">{tapeNote}</li>}
      </> : null}
      physical={<>{pendingCard && <li><Button variant="ghost" disabled={reported} onClick={() => void reportCard()}>{reported ? "Card reported, withdrawn" : "Report this card"}</Button></li>}<li><Button variant="ghost" onClick={()=>machine.current?.pressPcPower()}>PC power: {powered?"on":"off"}</Button></li><li><Button variant="ghost" onClick={()=>machine.current?.pressMonitorPower()}>Monitor: {tube?"on":"off"}</Button></li><li><Button variant="ghost" onClick={()=>machine.current?.toggleTurbo()}>Turbo: {turbo?"on":"off"}</Button></li><li><Button variant="ghost" onClick={()=>machine.current?.pressDegauss()}>Degauss monitor</Button></li>{toys&&powered&&<li><Button variant="ghost" onClick={()=>void printScreen()}>Print</Button></li>}{printJob&&<li><Button variant="ghost" onClick={()=>{savePrint();window.dispatchEvent(new Event("dialup:printout-away"));}}>Save printout</Button></li>}{printJob&&<li><Button variant="ghost" onClick={()=>window.dispatchEvent(new Event("dialup:printout-away"))}>Put printout away</Button></li>}{toys&&<li><Button variant="ghost" onClick={floppySlot}>{floppy?"Eject floppy":"Floppy disks"}</Button></li>}<li><label>Brightness <input type="range" min="0" max="1" step=".01" value={cfg.brightness} onChange={e=>{const v=+e.target.value;update({brightness:v});if(machine.current)machine.current.engine.crt.brightness=brightnessGain(v);}}/></label></li><li><label>Contrast <input type="range" min="0" max="1" step=".01" value={cfg.contrast} onChange={e=>{const v=+e.target.value;update({contrast:v});if(machine.current)machine.current.engine.crt.contrast=contrastGain(v);}}/></label></li><li><label>Modem volume <input type="range" min="0" max="1" step=".01" value={cfg.modemVolume} onChange={e=>{const v=+e.target.value;update({modemVolume:v});audio.setMix({modemVolume:v});}}/></label></li><li><label>Speaker volume <input type="range" min="0" max="1" step=".01" value={cfg.musicVolume} onChange={e=>{const v=+e.target.value;update({musicVolume:v});audio.setMix({musicVolume:v});}}/></label></li><li><Button variant="ghost" onClick={()=>lean(!leanRef.current)}>Lean {leaned?"back":"in"}</Button></li></>}
      muted={cfg.muted}
      reduced={reduced}
      lamp={cfg.lamp}
      onMute={() => { const v = !cfg.muted; update({ muted: v }); audio.setMix({ muted: v }); }}
      onReduced={() => update({ reducedMotion: !reduced })}
      onLamp={toggleLamp}
      onSkip={() => { audio.unlock(); void navigate({ to: "/dial/$number/$year/$pack/$file", params: { number: "555-0142", year: "1994", pack: HOUSE_PACK, file: "DC-LOGO.ANS" } }); }}
    />
  );

  if (!layout) return <main className="room" aria-busy="true"><h1 className="sr-only">Dial-Up: a 486 in a dark basement</h1></main>;

  return (
    <Room
      monitor={monitor}
      controls={<>{cardWaiting && <button type="button" data-touch className="postcard-note" style={fractionStyle(GLASS)} onClick={pickUp}><span>you have mail.<br/>tap to pick up.</span></button>}<div className="plate-controls" style={{left:"55.73%",top:"59.72%",width:"5.73%",height:"4.17%"}}><Knob label="Contrast knob" value={cfg.contrast} onChange={v=>{update({contrast:v});if(machine.current)machine.current.engine.crt.contrast=contrastGain(v);}}/><Knob label="Brightness knob" value={cfg.brightness} onChange={v=>{update({brightness:v});if(machine.current)machine.current.engine.crt.brightness=brightnessGain(v);}}/></div><Button variant="ghost" className="plate-monitor-power" data-touch aria-label={tube?"Monitor off":"Monitor on"} style={{left:"62.63%",top:"59.26%",width:"3.26%",height:"4.17%"}} onClick={()=>machine.current?.pressMonitorPower()}/></>}
      powered={powered}
      turbo={turbo}
      lamp={cfg.lamp}
      leaned={leaned}
      recording={tape === "rec"}
      reduced={reduced}
      modemVolume={cfg.modemVolume}
      musicVolume={cfg.musicVolume}
      onMusicVolume={(v) => { update({ musicVolume: v }); audio.setMix({ musicVolume: v }); }}
      getState={getState}
      onPcPower={() => machine.current?.pressPcPower()}
      onTurbo={() => machine.current?.toggleTurbo()}
      onLamp={toggleLamp}
      onModemVolume={(v) => { update({ modemVolume: v }); audio.setMix({ modemVolume: v }); }}
      onLean={lean}
      onDegauss={() => machine.current?.pressDegauss()}
      toys={{ live: toys, floppyIn: floppy !== null, onFloppySlot: floppySlot }}
    >
      {printJob && <Printout key={printJob.id} job={printJob} lamp={cfg.lamp} reduced={reduced} skip={printSkip} onSave={savePrint} onRisen={() => { printSkipOpen.current = false; }} onGone={dropPrint} />}
      {floppyOpen && toys && <FloppyCloseup lamp={cfg.lamp} onPick={setFloppy} onClose={() => setFloppyOpen(false)} />}
      {layout === "tube" && <ContextBar hints={hints} powered={powered} onPower={() => machine.current?.pressPcPower()} onKey={h => machine.current?.pressHint(h)} onText={t => machine.current?.typeText(t)} />}
      {hatch}
    </Room>
  );
}
