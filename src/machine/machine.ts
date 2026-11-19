// The PC: off -> boot -> dos -> comm -> dialing -> handshake -> session -> hangup.
// Local programs (BIOS, DOS, TELEWIRE) draw straight to the terminal; the board only through the modem.
import { Ansi, a, box, center, pad, rpad } from "@/bbs/ansi";
import { DIRECTORY, boardAt, normalizeNumber, phoneBook, type DeepLink, type DirEntry, type HostIO, type KeyHint } from "@/bbs/io";
import { doorMenu } from "@/bbs/door";
import { localView, runBoard } from "@/bbs/board";
import * as drive from "./drive";
import { kplay, MUSIC, screenSaver, SAVERS, type Saver, type LocalEnv } from "./programs";
import { installed, runRelease } from "./releases";
import { count } from "@/data/net";
import { audio } from "@/audio/bus";
import { Engine } from "./engine";
import { Aborted, KeyQueue, toKey, type Key } from "./keyboard";
import { allowedSpeeds, loadProfile, maxSpeed, saveProfile, type Profile } from "./storage";
import { Signal } from "./signals";
import { handshakeMs, DTMF_OFF_MS, DTMF_ON_MS } from "@/audio/tables";
import { Terminal } from "@/term/terminal";
import type { Speed } from "@/modem/modem";

export type MachineState = "off" | "boot" | "dos" | "comm" | "dialing" | "handshake" | "session" | "hangup";

const CALL_MINUTES = 60;

/** ?debug=busy forces a busy signal on the first dial; ?debug=time=1 makes a call last 1 minute. Combine with commas. */
export function parseDebug(search: string): { busy: boolean; minutes: number | null; offline: boolean } {
  const v = new URLSearchParams(search).get("debug") ?? "";
  const parts = v.split(",").map((p) => p.trim().toLowerCase());
  const t = parts.find((p) => p.startsWith("time="));
  const m = t ? Number(t.slice(5)) : NaN;
  return { busy: parts.includes("busy"), minutes: Number.isFinite(m) && m > 0 ? m : null, offline: parts.includes("offline") };
}

const NAV: KeyHint[] = [{ label: "↑", key: "ArrowUp" }, { label: "↓", key: "ArrowDown" }, { label: "ENTER", key: "Enter" }, { label: "ESC", key: "Escape" }];
const hk = (c: string, label = c): KeyHint => ({ label, key: c, ch: c });
const CAPTURE = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown", "Backspace", "Tab", "Home", "End", "Enter", "Escape", "F1", "F3", "F5"]);

export class Machine {
  state = new Signal<MachineState>("off");
  powered = new Signal(false);
  tube = new Signal(false);
  turbo = new Signal(false);
  private everOn = false;
  keys = new KeyQueue();
  profile: Profile = loadProfile();
  private gen = 0;
  private callsThisPower = 0;
  private lastBusy = false;
  private skipping = false;
  private cwd = "C:\\";
  private deepLink: (DeepLink & { number: string }) | null = null;
  /** Set before powerOn for a wrong URL: TELEWIRE dials it, gets NO CARRIER, drops to the launcher. */
  lostAt: string | null = null;
  private timeTimer: ReturnType<typeof setInterval> | null = null;
  private boardOverlay: Terminal | null = null;
  private artOpen = false;
  private portrait = false;
  /** Portrait phone: art is a landscape thing, so TELEWIRE asks you to turn the phone (in text mode). */
  setPortrait(v: boolean) { this.portrait = v; this.applyOverlay(); }
  private applyOverlay() {
    const term = this.engine.term;
    if (this.artOpen && this.portrait) {
      const ov = new Terminal({ cols: 80 }, { masked: true });
      const x = a(); box(x, 8, 16, 48, 9, 14, "TELEWIRE");
      x.at(10, 20).k(15, "This picture is wider than it is tall.");
      x.at(12, 20).k(11, "Turn your phone sideways: ").k(14, "landscape").k(11, ".");
      x.at(14, 20).k(8, "Menus are fine either way.");
      ov.feed(x.build());
      term.overlay = ov;
    } else term.overlay = this.boardOverlay;
    term.version++;
  }
  private debug = parseDebug(typeof location !== "undefined" ? location.search : "");
  private creaked = false;
  /** Keys the current screen accepts (out of band, for the touch context bar). */
  hints = new Signal<KeyHint[]>([]);
  private get callMinutes() { return this.debug.minutes ?? CALL_MINUTES; }

  constructor(public engine: Engine) {}

  /** A tap on the touch context bar types this key. */
  pressHint(h: KeyHint) {
    if (!this.powered.value) return;
    this.lastInput = Date.now(); this.inactivityWarned = false;
    audio.emit("keyDown", h.key || " "); setTimeout(() => audio.emit("keyUp", h.key || " "), 70);
    if (h.ch && h.ch.length > 1) { // macro, e.g. "DIAL\r"
      for (const c of h.ch) this.keys.push(c === "\r" ? { key: "Enter", ch: null, ctrl: false, alt: false } : { key: c, ch: c.charCodeAt(0), ctrl: false, alt: false });
      return;
    }
    this.keys.push({ key: h.key, ch: h.ch ? h.ch.charCodeAt(0) : null, ctrl: false, alt: false });
  }
  /** A tap on a text row of the tube (1-based). Programs that list things treat it like select/Enter. */
  tap(row: number) {
    if (!this.powered.value) return;
    this.lastInput = Date.now(); this.inactivityWarned = false;
    this.keys.push({ key: "Tap", ch: null, ctrl: false, alt: false, tapRow: row });
  }
  /** Characters typed into the hidden input that summons the phone's keyboard. */
  typeText(ch: string) {
    if (!this.powered.value) return;
    this.lastInput = Date.now(); this.inactivityWarned = false;
    for (const c of ch) { const code = c.charCodeAt(0); if (code >= 0x20 && code < 0x7f) this.keys.push({ key: c, ch: code, ctrl: false, alt: false }); }
  }

  // ── input ──────────────────────────────────────────────────────
  handleKeyDown(e: KeyboardEvent) {
    // the keyboard is a physical object: it clicks whether or not anything is listening
    if (!e.repeat && !e.metaKey) audio.emit("keyDown", e.key);
    if (!this.powered.value) return;
    this.lastInput = Date.now(); this.inactivityWarned = false;
    if (e.metaKey || (e.ctrlKey && !["c", "C"].includes(e.key))) return;
    if (CAPTURE.has(e.key) || e.key.length === 1) e.preventDefault();
    this.keys.push(toKey(e));
  }
  handleKeyUp(e: KeyboardEvent) { if (!e.metaKey) audio.emit("keyUp", e.key); }

  /** PC master rocker. The very first press also switches the tube on, so nobody has to hunt. */
  pressPcPower() { audio.unlock(); this.togglePower(); }
  /** Monitor button: first press powers everything; afterwards it switches only the tube. */
  pressMonitorPower() {
    audio.unlock();
    if (!this.everOn) this.powerOn();
    else this.setTube(!this.tube.value);
  }
  setTube(on: boolean) {
    if (on === this.tube.value) return;
    this.engine.setTube(on);
    this.tube.set(on);
    audio.emit(on ? "monitorOn" : "monitorOff");
  }
  toggleTurbo() { this.turbo.set(!this.turbo.value); this.engine.turbo = this.turbo.value; }

  // ── power ──────────────────────────────────────────────────────
  togglePower() { if (this.powered.value) this.powerOff(); else this.powerOn(); }

  powerOn(deepLink?: DeepLink & { number: string }) {
    if (this.powered.value) return;
    audio.unlock();
    if (!this.everOn) { this.everOn = true; this.setTube(true); }
    this.gen++;
    this.keys.revive();
    this.deepLink = deepLink ?? null;
    this.powered.set(true);
    this.engine.term.setMode({ cols: 80, ice: false, ninePixel: true });
    this.engine.term.reset();
    this.engine.modem.clear();
    this.engine.powerOn();
    audio.emit("powerOn");
    count("powered_on");
    this.callsThisPower = 0;
    if (!this.creaked) { this.creaked = true; const g0 = this.gen; setTimeout(() => { if (g0 === this.gen) audio.emit("stairCreak"); }, 20000); }
    void this.run(this.gen);
  }

  powerOff() {
    if (!this.powered.value) return;
    this.lastInput = Date.now(); this.inactivityWarned = false;
    this.gen++;
    this.keys.abort("power");
    this.stopTimer();
    this.engine.powerOff();
    this.powered.set(false);
    this.hints.set([]);
    this.state.set("off");
    audio.emit("powerOff");
  }

  private alive(g: number) { if (g !== this.gen) throw new Aborted("power"); }

  // ── helpers ────────────────────────────────────────────────────
  out(x: Ansi | string) { this.engine.local(typeof x === "string" ? a().t(x).build() : x.build()); }
  private key(): Promise<Key> { return this.keys.next(); }
  private localEnv(): LocalEnv {
    return { out: (x) => this.out(x), nextOr: (p) => this.keys.nextOr(p), reduced: () => this.engine.crt.reducedMotion };
  }
  static IDLE_MS = 45_000;
  private saver: Saver = (() => { try { const v = localStorage.getItem("dialup.saver"); return SAVERS.includes(v as Saver) ? v as Saver : "starfield"; } catch { return "starfield"; } })();
  private lastInput = Date.now();
  private inactivityWarned = false;
  static WARNING_MS = 240_000;
  static HANGUP_MS = 300_000;
  /** Next key at DOS or in the directory; after 45 idle seconds the starfield runs until a key. Returns null if it ran. */
  private async idleKey(g: number): Promise<Key | null> {
    const k = await this.keys.nextOr(this.sleep(Machine.IDLE_MS));
    this.alive(g);
    if (k) return k;
    const prev = this.state.value;
    this.hints.set([{ label: "WAKE", key: "Enter" }]);
    this.engine.term.cursorVisible = false;
    await screenSaver(this.localEnv(), this.saver);
    this.alive(g);
    this.engine.term.cursorVisible = true;
    this.state.set(prev);
    return null;
  }
  /** A HostIO for local programs (VIEW): output goes straight to the screen, instantly. */
  private localIO(): HostIO {
    const term = this.engine.term;
    return {
      send: (b) => this.engine.local(b), key: () => this.keys.next(), keyOrDrain: () => this.keys.nextOr(Promise.resolve()),
      keyTimeout: (ms) => this.keys.nextOr(this.sleep(ms)), hint: (k) => this.hints.set(k), drain: async () => {}, flush: () => {},
      pause: () => {}, resume: () => {}, isPaused: () => false, clearOutput: () => {},
      client: {
        setMode: (m) => { term.setMode(m); term.reset(); }, scroll: (d) => term.scrollView(d),
        scrollTo: (w) => term.scrollViewTo(w === "top" ? term.scrollbackLines : 0), markTop: () => {},
        overlay: (bytes) => {
          if (!bytes) this.boardOverlay = null;
          else { const ov = new Terminal({ cols: 80 }, { masked: true }); ov.feed(bytes); this.boardOverlay = ov; }
          this.applyOverlay();
        },
        artOpen: (on) => { this.artOpen = on; this.applyOverlay(); }, rows: () => term.rows,
        disk: () => audio.emit("diskSeek"), saveDownload: async () => null, kplay: async () => {},
      },
      speed: 28800, node: 0, entry: DIRECTORY[0], profile: this.profile, save: () => saveProfile(this.profile), timeLeftMs: () => 3600_000,
    };
  }

  /** Skippable wait: Esc or Space skip (and keep skipping the rest of this phase). */
  private async wait(ms: number) {
    if (this.skipping) return true;
    const timer = new Promise((r) => setTimeout(r, ms));
    for (;;) {
      const k = await this.keys.nextOr(timer);
      if (k === null) return false;
      if (k.key === "Escape" || k.key === " ") { this.skipping = true; return true; }
    }
  }
  private sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  private async run(g: number) {
    try {
      if (this.deepLink) {
        await this.sleep(500); this.alive(g);
        const entry = boardAt(this.deepLink!.number) ?? DIRECTORY[0];
        await this.call(entry, g, true);
        await this.comm(g);
        await this.dos(g, false);
      } else if (this.lostAt) {
        const path = this.lostAt.slice(0, 60); this.lostAt = null;
        this.state.set("dos");
        await this.sleep(700); this.alive(g);
        this.out(a().reset().cls().k(15, "TELEWIRE v2.1").k(7, " — terminal mode").nl(2).k(7, "ATZ").nl().k(7, "OK").nl());
        this.out(a().k(7, `ATDT ${path}`).nl());
        audio.emit("offHook");
        await this.wait(1400); this.alive(g);
        this.out(a().nl().k(15, "NO CARRIER").nl(2));
        audio.emit("hangup");
        this.out(a().k(7, "TELEWIRE: nobody answers at that number. It may have been disconnected.").nl()
          .k(8, "(error 404: the page you dialed is not in service)").nl(2).k(7, "TELEWIRE v2.1 · line closed.").nl(2));
        this.skipping = false;
        await this.dos(g, false);
      } else {
        await this.boot(g);
        await this.dos(g, true);
      }
    } catch (e) {
      if (!(e instanceof Aborted)) { console.error(e); await this.fatal(g, e); }
    }
  }

  /** An unexpected error: a period-style fatal line on the CRT, then R reboots (power cycle). */
  private async fatal(g: number, e: unknown) {
    try {
      const msg = String((e as Error)?.message ?? e).replace(/[^\x20-\x7e]/g, "?").slice(0, 60).toUpperCase();
      this.engine.term.overlay = null; this.boardOverlay = null; this.artOpen = false;
      this.engine.term.setMode({ cols: 80, ice: false, ninePixel: true }); this.engine.term.reset();
      this.engine.modem.clear();
      this.out(a().reset().cls().nl().k(15, "Kestrel DOS 5.0").nl(2)
        .k(12, "EXCEPTION 0D AT 0142:1A2B  General Protection Fault").nl()
        .k(7, msg).nl(2).k(7, "The system has been halted.").nl()
        .k(7, "Press ").k(15, "R").k(7, " to reboot, or cycle the power switch.").nl());
      audio.emit("beep");
      this.hints.set([hk("R", "R reboot")]);
      for (;;) {
        const k = await this.key(); this.alive(g);
        if (k.ch !== null && String.fromCharCode(k.ch).toUpperCase() === "R") break;
      }
      this.powerOff();
      setTimeout(() => this.powerOn(), 1200);
    } catch { /* power went off while halted */ }
  }

  // ── BIOS ───────────────────────────────────────────────────────
  private async boot(g: number) {
    this.state.set("boot");
    this.hints.set([{ label: "ESC skip", key: "Escape" }]);
    this.skipping = false;
    const fast = this.profile.fastBoot;
    const s = fast ? 0.4 : 1;
    await this.sleep(700); this.alive(g); // tube warm-up
    const x = a().cls();
    x.at(1, 1).k(15, "Kestrel Systems BIOS v1.04").k(7, "  Copyright (C) 1991-92 Kestrel Systems Inc.");
    x.at(1, 72).k(9, "▄█▀▀▄").at(2, 72).k(9, "█▄▄▀ ").at(3, 72).k(1, "▀ KS ");
    x.at(3, 1).k(7, "486DX-33 CPU at 33 MHz, math coprocessor present").at(5, 1).k(7, "Memory Test :      ");
    this.out(x);
    for (let k = 0; k <= 4096; k += 128) {
      this.out(a().at(5, 15).k(15, `${String(k).padStart(5)}K`));
      if (!this.skipping) { await this.wait(38 * s); this.alive(g); }
    }
    this.out(a().at(5, 15).k(15, " 4096K OK"));
    audio.emit("beep");
    const lines: [number, string][] = [
      [7, "Detecting IDE Primary Master ... KS-120A  (120 MB)"],
      [7, "Detecting IDE Primary Slave  ... None"],
      [7, "Floppy Drive A: 1.44M, 3.5 in."],
      [7, "Serial Ports  : COM1 3F8  COM2 2F8   Parallel: LPT1 378"],
    ];
    let row = 7;
    for (const [c, t] of lines) {
      if (t.startsWith("Floppy")) audio.emit("floppySeek"); else audio.emit("diskSeek");
      this.out(a().at(row++, 1).k(c, t));
      await this.wait(420 * s); this.alive(g);
    }
    this.out(a().at(13, 1).k(7, "Press ").k(15, "DEL").k(7, " to enter SETUP, ").k(15, "ESC").k(7, " to skip memory test").at(24, 1).k(8, "09/14/92-KS486-0104"));
    await this.wait(700 * s); this.alive(g);
    this.profile.fastBoot = true;
    saveProfile(this.profile);
  }

  // ── DOS ────────────────────────────────────────────────────────
  private async dos(g: number, autoexec: boolean) {
    this.state.set("dos");
    this.skipping = false;
    if (autoexec) {
      this.out(a().cls().k(7, "Starting Kestrel DOS...").nl(2));
      audio.emit("diskSeek");
      await this.wait(400); this.alive(g);
      const boot = ["DEVICE=C:\\DOS\\HIMEM.SYS", "HIMEM: Kestrel Extended Memory Manager v2.77", "DOS=HIGH", "FILES=30", "BUFFERS=20",
        "DEVICE=C:\\DOS\\KSMOUSE.SYS  (no mouse? fine.)", "", "C:\\>PROMPT $P$G", "C:\\>PATH C:\\DOS;C:\\TELEWIRE", "C:\\>MODE COM2:9600,N,8,1",
        "COM2: 9600,n,8,1,-", ""];
      for (const l of boot) { this.out(a().k(7, l).nl()); await this.wait(70); this.alive(g); }
      this.out(a().k(7, "C:\\>MENU").nl());
      await this.wait(350); this.alive(g);
    }
    await this.launcher(g);
  }

  private async launcher(g: number) {
    let sel = 0;
    const labels = ["Dial a BBS", "Downloads", "Games / Programs", "Screen savers", "DOS prompt"];
    for (;;) {
      this.alive(g); this.state.set("dos");
      this.engine.term.setMode({cols: 80, ice: false, ninePixel: true});
      this.engine.term.cursorVisible = false;
      const x = a().reset().cls();
      x.at(1,1).c(0,3).t(pad(" KESTREL MENU  ·  486DX-33",79)).reset();
      box(x,4,13,54,16,11,"PROGRAM LAUNCHER",true);
      labels.forEach((l,i) => x.at(7+i*2,17).c(i===sel?0:15,i===sel?7:0).t(pad(` ${i+1}  ${l}`,44)));
      x.at(22,13).k(7,"Arrows select · ENTER starts · 1-5 quick launch");
      this.out(x); this.hints.set([...NAV,...labels.map((_,i)=>hk(String(i+1)))]);
      const k = await this.idleKey(g); if (!k) continue;
      const c = k.ch !== null ? String.fromCharCode(k.ch) : "";
      if (k.key === "ArrowUp") { sel = (sel+4)%5; continue; }
      if (k.key === "ArrowDown") { sel = (sel+1)%5; continue; }
      if (k.key === "Tap" && k.tapRow) { const n = Math.floor((k.tapRow-7)/2); if(n<0||n>4) continue; sel=n; }
      else if (/^[1-5]$/.test(c)) sel = +c-1;
      else if(k.key !== "Enter") continue;
      if(sel===0) await this.comm(g);
      if(sel===1) await this.downloadMenu(g);
      if(sel===2) await this.programMenu(g);
      if(sel===3) await this.saverMenu(g);
      if(sel===4) await this.prompt(g);
    }
  }
  private async programMenu(g: number) {
    for (;;) { const fs=await installed(); const x=a().cls();box(x,2,4,72,21,11,"GAMES / PROGRAMS");x.at(5,8).k(15,"0 BASEMENT CRAWL");fs.slice(0,9).forEach((f,i)=>x.at(7+i,8).k(11,`${i+1} ${f.name}`));x.at(21,8).k(8,"Number starts / ESC menu");this.out(x);const k=await this.key();if(k.key==="Escape")return;const n=(k.ch??0)-48;if(n===0)await doorMenu({io:this.localIO(),send:y=>this.out(y),user:"GUEST",guest:true,hint:h=>this.hints.set(h)});else if(fs[n-1])await runRelease(this.localEnv(),fs[n-1].name.replace(".EXE",""));this.alive(g);}
  }
  private async downloadMenu(g: number) {
    let sel = 0;
    for (;;) {
      const fs = await drive.list(); this.alive(g);
      sel = Math.max(0,Math.min(sel,fs.length-1));
      const x=a().reset().cls(); box(x,2,3,74,21,11,"C:\\DOWNLOAD");
      const start=Math.floor(sel/15)*15;
      fs.slice(start,start+15).forEach((f,i)=>x.at(5+i,6).c(start+i===sel?0:15,start+i===sel?7:0).t(pad(f.name,24)+pad(f.pack,24)+rpad(String(f.bytes.length),16)));
      if(!fs.length) x.at(6,6).k(7,"No downloads yet. Dial a BBS and press D on a file.");
      x.at(21,6).k(8,"Arrows select · ENTER / V view · ESC menu"); this.out(x); this.hints.set([...NAV,hk("V")]);
      const k=await this.idleKey(g);if(!k) continue;
      if(k.key==="Escape")return;
      if(k.key==="ArrowUp")sel=Math.max(0,sel-1);
      else if(k.key==="ArrowDown")sel=Math.min(fs.length-1,sel+1);
      else if((k.key==="Enter"||k.ch===86||k.ch===118)&&fs[sel]) await this.dosCommand(`VIEW ${fs[sel].name}`,g);
    }
  }
  private drifterInstalled=false;
  private async saverMenu(g: number) {
    this.drifterInstalled=(await installed()).some(f=>f.name==="DRIFTER.EXE");
    for (;;) {
      const x=a().reset().cls();box(x,5,15,50,14,11,"SCREEN SAVERS");
      (SAVERS.filter(v=>v!=="drifter"||!!this.drifterInstalled)).forEach((v,i)=>x.at(8+i*2,19).k(15,`${i+1}  ${v === "drifter" ? "Drifter plasma" : v === "number" ? "Bouncing board number" : v === "rain" ? "Falling characters" : "Starfield"}${this.saver===v?" *":""}`));
      x.at(20,15).k(8,"1-4 select and preview · any key ends · ESC menu");this.out(x);this.hints.set([hk("1"),hk("2"),hk("3"),hk("4"),{label:"ESC",key:"Escape"}]);
      const k=await this.key();this.alive(g);if(k.key==="Escape")return;
      const n=(k.ch??0)-49;if(n<0||n>3||(n===3&&!this.drifterInstalled))continue;
      this.saver=SAVERS[n];try{localStorage.setItem("dialup.saver",this.saver);}catch{}
      await screenSaver(this.localEnv(),this.saver);
    }
  }
  private async prompt(g: number) {
    this.out(a().reset().cls().k(7,"Kestrel DOS 5.0").nl().k(7,"Type MENU for the menu, DIAL to call a BBS, HELP for commands.").nl(2));
    for (;;) {
      this.hints.set([{label:"type",key:"",text:true},{label:"MENU",key:"",ch:"MENU\r"},{label:"DIAL",key:"",ch:"DIAL\r"},{label:"ENTER",key:"Enter"}]);
      this.out(a().k(7,`${this.cwd}>`));
      const line=await this.readLine(g,70,true);if(line===null)return;
      const r=await this.dosCommand(line.trim(),g);
      if(r==="menu")return;
      if(r==="comm") {await this.comm(g);return;}
      if(/^(VIEW|KPLAY|WARDIAL)\b/i.test(line))return;
    }
  }

  private async readLine(g: number, max: number): Promise<string>;
  private async readLine(g: number, max: number, cancelable: true): Promise<string | null>;
  private async readLine(g: number, max: number, cancelable = false): Promise<string | null> {
    let s = "";
    for (;;) {
      const k = await this.idleKey(g);
      if (!k) { this.out(a().reset().cls().k(7, `${this.cwd}>${s}`)); continue; }
      if (k.key === "Enter") { this.out(a().nl()); return s; }
      if (k.key === "Backspace") { if (s) { s = s.slice(0, -1); this.out(a().raw("\b \b")); } continue; }
      if (k.key === "Escape" && cancelable) return null;
      if (k.key === "Escape") { this.out(a().raw("\\").nl().k(7, `${this.cwd}>`)); s = ""; continue; }
      if (k.ch !== null && s.length < max) { s += String.fromCharCode(k.ch); this.out(a().k(7, String.fromCharCode(k.ch))); }
    }
  }

  private async dosCommand(line: string, g: number): Promise<"comm" | "menu" | void> {
    const [cmd0, ...rest] = line.split(/\s+/);
    const cmd = (cmd0 ?? "").toUpperCase();
    const arg = rest.join(" ").toUpperCase();
    const p = (t: string, c = 7) => this.out(a().k(c, t).nl());
    const now = new Date();
    const program=(cmd === "RUN" ? arg : cmd).replace(/\.EXE$/, "").replace(/^.*\\/, "");
    if((await installed()).some(f=>f.name===program+".EXE")){await runRelease(this.localEnv(),program);return;}
    switch (cmd) {
      case "": return;
      case "CLS": this.out(a().cls()); return;
      case "VER": p(""); p("Kestrel DOS Version 5.0"); p(""); return;
      case "DATE": p(`Current date is ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(1993, now.getMonth(), now.getDate()).getDay()]} ${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-1993`); return;
      case "TIME": p(`Current time is ${now.toTimeString().slice(0, 8)}.${String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0")}`); return;
      case "HELP": case "/?":
        p("Kestrel DOS 5.0 commands:", 15);
        ["MENU       open KESTREL MENU", "DIAL       start TELEWIRE (TELEWIRE, EXIT)",
         "RUN name   run an installed warez program", "DIR [dir]  list files", "VIEW file  read a download", "KPLAY file play tracker music",
         "DEL file   erase a download (ERASE)", "CD dir     change directory (CHDIR)",
         "CLS        clear the screen", "VER        DOS version", "DATE       date", "TIME       time",
         "TYPE file  read AUTOEXEC.BAT, CONFIG.SYS or README.TXT", "MEM        memory report",
         "WARDIAL    scan 555-0100 through 555-0199", "HELP       this list (/? )",
         "XYZZY      test the cave", "WIN        check window installation", "FORMAT     ask about formatting",
         "DIG/TETRA  test game installation", "SYSOP      locate Static"].forEach((l) => p("  " + l)); return;
      case "MEM":
        p(""); p("    655360 bytes total conventional memory"); p("    633904 bytes available to Kestrel DOS"); p("    598016 largest executable program size");
        p("   3407872 bytes total contiguous extended memory"); p("   3407872 bytes available XMS memory"); p("           Kestrel DOS resident in High Memory Area"); p(""); return;
      case "CD": case "CHDIR": {
        if (!arg) { p(this.cwd); return; }
        const t = arg === ".." || arg === "\\" ? "C:\\" : arg.replace(/^C:\\?/, "").replace(/\\$/, "");
        if (t === "C:\\") { this.cwd = "C:\\"; return; }
        if (["TELEWIRE", "GAMES", "DOS", "DOWNLOAD", "WAREZ"].includes(t) && this.cwd === "C:\\") { this.cwd = `C:\\${t}`; return; }
        p("Invalid directory"); return;
      }
      case "DIR": {
        if(arg.includes("WAREZ")||this.cwd.includes("WAREZ")){p(" Directory of C:\\WAREZ");for(const f of await installed())p(`  <DIR> ${f.name.replace(".EXE","")} / ${f.name}`);return;}
        if (/^(C:)?\\?DOWNLOAD\\?$/.test(arg) || (!arg && this.cwd === "C:\\DOWNLOAD")) { await this.dirDownload(); return; }
        const files = this.cwd === "C:\\" ? [["COMMAND", "COM", "47845"], ["AUTOEXEC", "BAT", "112"], ["CONFIG", "SYS", "97"], ["README", "TXT", "640"], ["WARDIAL", "EXE", "21504"], ["VIEW", "COM", "8812"], ["KPLAY", "EXE", "61440"], ["DOS", "<DIR>", ""], ["DOWNLOAD", "<DIR>", ""], ["TELEWIRE", "<DIR>", ""], ["GAMES", "<DIR>", ""]]
          : this.cwd.endsWith("TELEWIRE") ? [["TELEWIRE", "EXE", "184320"], ["TELEWIRE", "DIR", "1024"], ["CAPTURE", "LOG", "0"]]
          : this.cwd.endsWith("GAMES") ? [["DIG", "EXE", "34012"], ["TETRA", "EXE", "41210"]]
          : [["HIMEM", "SYS", "11552"], ["KSMOUSE", "SYS", "32158"], ["EDIT", "COM", "413"]];
        p(""); p(" Volume in drive C is KESTREL"); p(" Volume Serial Number is 1A2B-0142"); p(` Directory of ${this.cwd}`); p("");
        for (const [n, ext, size] of files) p(`${pad(n, 9)}${ext === "<DIR>" ? pad("", 4) + pad("<DIR>", 10) : pad(ext, 4) + rpad(size, 10)}  11-17-93   4:20a`);
        p(`${rpad(String(files.length), 9)} file(s)   ${rpad("88,342,528", 12)} bytes free`); p(""); return;
      }
      case "TYPE": {
        const docs: Record<string, string[]> = {
          "AUTOEXEC.BAT": ["@ECHO OFF", "PROMPT $P$G", "PATH C:\\DOS;C:\\TELEWIRE", "MODE COM2:9600,N,8,1", "TELEWIRE"],
          "CONFIG.SYS": ["DEVICE=C:\\DOS\\HIMEM.SYS", "DOS=HIGH", "FILES=30", "BUFFERS=20"],
          "README.TXT": ["Welcome to your Kestrel 486!", "Type DIAL to call a BBS. DEAD CARRIER is 555-0142.", "Don't pick up the phone while the modem is on line."],
        };
        const d = docs[arg.replace(/^C:\\/, "")];
        if (!d || this.cwd !== "C:\\") { p("File not found"); return; }
        d.forEach((l) => p(l)); return;
      }
      case "VIEW": case "KPLAY": case "DEL": case "ERASE": {
        const name = arg.replace(/^(C:)?\\?(DOWNLOAD\\)?/, "");
        if (!name) { p(cmd === "DEL" || cmd === "ERASE" ? "Required parameter missing" : `usage: ${cmd} <file>   (files live in C:\\DOWNLOAD)`); return; }
        if (cmd === "DEL" || cmd === "ERASE") { audio.emit("diskSeek"); p((await drive.del(name)) ? "" : "File not found"); return; }
        const f = await drive.get(name);
        if (!f) { p("File not found"); p("Downloaded files live in C:\\DOWNLOAD. Type DIR C:\\DOWNLOAD.", 8); return; }
        audio.emit("diskSeek");
        if (cmd === "KPLAY" || MUSIC.test(f.name)) {
          if (!MUSIC.test(f.name)) { p("KPLAY: not a module (MOD, S3M, XM, IT)"); return; }
          this.engine.term.cursorVisible = false;
          await kplay(this.localEnv(), f.name, f.bytes); this.alive(g);
        } else {
          this.engine.term.cursorVisible = false;
          try { await localView(this.localIO(), f); } finally { this.alive(g); }
          this.engine.term.setMode({ cols: 80, ice: false, ninePixel: true }); this.engine.term.reset();
        }
        this.engine.term.cursorVisible = true;
        this.hints.set([]);
        this.out(a().reset().cls());
        return;
      }
      case "MENU": return "menu";
      case "DIAL": case "TELEWIRE": case "EXIT": return "comm";
      case "WARDIAL": if (this.cwd !== "C:\\") { p("Bad command or file name"); return; } await this.wardial(g); return;
      case "XYZZY": p("Nothing happens."); return;
      case "WIN": p("Kestrel Windows is not installed. You have a modem. What more do you need?"); return;
      case "FORMAT": p("Nice try. Static backed up nothing, so let's not."); return;
      case "DIG": case "TETRA": p("This program requires a math coprocessor and a sense of humor."); return;
      case "SYSOP": p("Static is asleep under the stairs. Shh."); return;
      default: p("Bad command or file name. Try HELP.");
    }
    void g;
  }

  private async dirDownload() {
    const p = (t: string, c = 7) => this.out(a().k(c, t).nl());
    const fs = await drive.list();
    p(""); p(" Volume in drive C is KESTREL"); p(" Directory of C:\\DOWNLOAD"); p("");
    p(`${pad(".", 13)}${pad("<DIR>", 10)}`);
    for (const f of fs) {
      const [n, e = ""] = f.name.split(".");
      const d = new Date(f.at);
      p(`${pad(n, 9)}${pad(e, 4)}${rpad(String(f.bytes.length), 10)}  ${drive.dosDate(f.year, d)}  ${pad(f.pack, 12)}`, MUSIC.test(f.name) ? 10 : 7);
    }
    p(`${rpad(String(fs.length), 9)} file(s)   ${rpad(String(drive.DRIVE_CAP - drive.used(fs)), 12)} bytes free in DOWNLOAD`);
    p(fs.length ? "VIEW <file> shows it · KPLAY <file> plays music · DEL <file> erases" : "Nothing yet. Press D on a file in a BBS pack to download it.", 8);
    p("");
  }

  // ── WARDIAL.EXE ───────────────────────────────────────────────
  /** Scans 555-0100..0199 (about 20 s, Esc/Space finishes instantly) and finds every board, hidden ones too. */
  private async wardial(g: number) {
    this.skipping = false;
    this.hints.set([{ label: "ESC finish", key: "Escape" }]);
    const p = (x: Ansi) => this.out(x);
    p(a().nl().k(15, "WARDIAL v0.9").k(7, " · by ").k(13, "k0dez").k(7, " · \"if it hums, it's ours\"").nl());
    p(a().k(8, "COM2 9600 N81 · scanning exchange 555-01xx · ").k(12, "use responsibly, which you won't").nl(2));
    const found: string[] = [];
    const rng = (n: number) => { const x = Math.sin(n * 91.7) * 10000; return x - Math.floor(x); };
    for (let n = 100; n <= 199; n++) {
      const num = `555-0${n}`;
      const b = boardAt(num);
      const r = rng(n);
      const what = b ? "CARRIER" : r < 0.08 ? "BUSY" : r < 0.3 ? "VOICE" : r < 0.36 ? "FAX" : r < 0.4 ? "TONE" : "NO ANSWER";
      if (b) found.push(num);
      const col = b ? 10 : what === "VOICE" ? 14 : what === "FAX" || what === "TONE" ? 13 : 8;
      p(a().k(7, `ATDT ${num}  `).k(col, pad(what, 10)).k(8, b ? "<- logged to WARDIAL.LOG" : "").nl());
      if (b) audio.emit("diskSeek");
      if (!this.skipping) { await this.wait(b ? 900 : 180); this.alive(g); }
    }
    p(a().nl().k(15, `Scan complete. ${found.length} carriers found:`).nl());
    for (const num of found) p(a().k(10, `  ${num}`).k(8, "   carrier detected").nl());
    p(a().nl().k(8, "Dial any of them from TELEWIRE with ").k(15, "M").k(8, " (manual dial).").nl(2));
    this.profile.wardialed = true; saveProfile(this.profile);
    this.skipping = false;
  }

  // ── TELEWIRE ───────────────────────────────────────────────────
  private dirScreen(sel: number) {
    const x = a().c(15, 1).raw("\x1b[2J");
    x.at(1, 1).c(1, 7).t(pad(" TELEWIRE v2.1  ·  Dialing Directory", 59) + pad(`COM2  ${this.profile.speed} N81`, 20));
    box(x, 3, 3, 75, 13, 11, "DIRECTORY", true, 1);
    x.at(5, 6).c(14, 1).t(pad("#", 4) + pad("Name", 26) + pad("Number", 12) + pad("Speed", 8) + "Last call");
    x.at(6, 6).c(3, 1).t("─".repeat(68));
    this.book().forEach((d, i) => {
      const last = this.profile.lastCall[d.number] ?? "never";
      const text = pad(String(i + 1), 4) + pad(d.name, 26) + pad(d.number, 12) + pad(String(this.profile.speed), 8) + pad(last, 18);
      x.at(7 + i, 5);
      if (i === sel) x.c(1, 7).t(" " + text + " "); else x.c(15, 1).t(" " + text + " ");

    });
    box(x, 17, 3, 75, 5, 3, "KEYS", true, 1);
    x.at(18, 6).c(15, 1).t("↑↓").c(7, 1).t(" select    ").c(15, 1).t("ENTER").c(7, 1).t(" dial    ").c(15, 1).t("S").c(7, 1).t(" modem setup    ").c(15, 1).t("ESC").c(7, 1).t(" exit to menu");
    x.at(20, 6).c(7, 1).t("Inside a call: ").c(15, 1).t("ENTER").c(7, 1).t(" finish transfer  ").c(15, 1).t("SPACE").c(7, 1).t(" pause  ").c(15, 1).t("I").c(7, 1).t(" info  ").c(15, 1).t("ESC").c(7, 1).t(" back");
    const fs = this.profile.filesSeen.length;
    const nxt = fs < 5 ? `${5 - fs} more files to unlock 14400` : fs < 15 ? `${15 - fs} more files to unlock 28800` : "all speeds unlocked";
    x.at(23, 1).c(0, 3).t(pad(` ${fs} files seen · ${nxt}`, 79));
    x.at(24, 1).c(15, 1);
    return x;
  }

  private filesSeenCount() { return Math.max(this.profile.filesSeen.length, this.profile.serverFiles ?? 0); }
  private book() { return phoneBook(this.filesSeenCount()); }

  private async comm(g: number) {
    let sel = 0;
    audio.emit("diskSeek"); // TELEWIRE.EXE loading
    for (;;) {
      this.state.set("comm");
      this.engine.term.setMode({ cols: 80, ice: false, ninePixel: true });
      this.engine.term.cursorVisible = false;
      const book = this.book();
      sel = Math.min(sel, book.length - 1);
      this.hints.set([...NAV, hk("S", "S setup"), hk("M", "M dial #")]);
      this.out(this.dirScreen(sel));
      const k = await this.idleKey(g);
      if (!k) continue;
      const c = k.ch !== null ? String.fromCharCode(k.ch).toUpperCase() : "";
      if (k.key === "ArrowUp") sel = (sel + book.length - 1) % book.length;
      else if (k.key === "ArrowDown") sel = (sel + 1) % book.length;
      else if (c >= "1" && c <= String(book.length)) sel = +c - 1;
      else if (k.key === "Tap" && k.tapRow) {
        const i = k.tapRow - 7;
        if (i >= 0 && i < book.length) { if (i === sel) { this.engine.term.cursorVisible = true; await this.call(book[sel], g, false); } else sel = i; }
      }
      else if (k.key === "Enter" || c === "D") { this.engine.term.cursorVisible = true; await this.call(book[sel], g, false); }
      else if (c === "S") await this.setup(g);
      else if (c === "M") {
        this.hints.set([{ label: "type", key: "", text: true }, { label: "ENTER", key: "Enter" }, { label: "ESC", key: "Escape" }]);
        this.out(a().at(21, 6).c(14, 1).t("Manual dial · number: ").c(15, 1).raw("\x1b[K"));
        this.engine.term.cursorVisible = true;
        const typed = await this.readLine(g, 12, true);
        const num = typed === null ? null : normalizeNumber(typed);
        if (num) await this.call(boardAt(num) ?? { id: "unknown", name: num, number: num, mode: "archive", blurb: "", years: [1990, 1996] }, g, false);
      }
      else if (k.key === "Escape" || (k.alt && c === "X")) {
        this.engine.term.cursorVisible = true;
        this.out(a().reset().cls().k(7, "TELEWIRE v2.1 · line closed.").nl(2));
        return;
      }
    }
  }

  private async setup(g: number) {
    const speeds: Speed[] = [2400, 9600, 14400, 28800];
    let sel = Math.max(0, speeds.indexOf(this.profile.speed));
    for (;;) {
      const allowed = allowedSpeeds(this.profile);
      const x = a().c(15, 1).raw("\x1b[2J");
      x.at(1, 1).c(1, 7).t(pad(" TELEWIRE v2.1  ·  Modem Setup", 79));
      box(x, 4, 18, 44, 12, 11, "LINE SPEED", true, 1);
      speeds.forEach((s, i) => {
        const ok = allowed.includes(s);
        const label = pad(`${s} bps`, 12) + (s === 2400 ? "hard mode" : !ok ? (s === 14400 ? "locked: view 5 files" : "locked: view 15 files") : s === this.profile.speed ? "current" : "");
        x.at(6 + i * 2, 21);
        if (i === sel) x.c(1, 7).t(pad(" " + label, 38)); else x.c(ok ? 15 : 8, 1).t(pad(" " + label, 38));
      });
      x.at(14, 21).c(3, 1).t(`Files seen: ${this.profile.filesSeen.length}  ·  best: ${maxSpeed(this.profile)}`);
      x.at(17, 18).c(7, 1).t("↑↓ select · ENTER set · ESC back");
      this.hints.set(NAV);
      this.out(x);
      const k = await this.key(); this.alive(g);
      if (k.key === "ArrowUp") sel = Math.max(0, sel - 1);
      else if (k.key === "ArrowDown") sel = Math.min(3, sel + 1);
      else if (k.key === "Escape") return;
      else if (k.key === "Enter" && allowed.includes(speeds[sel])) { this.profile.speed = speeds[sel]; saveProfile(this.profile); return; }
    }
  }

  // ── the call ───────────────────────────────────────────────────
  private async call(entry: DirEntry, g: number, express: boolean) {
    const speed = allowedSpeeds(this.profile).includes(this.profile.speed) ? this.profile.speed : 9600;
    this.state.set("dialing");
    count("dialed");
    this.skipping = false;
    const t = express ? 0.25 : 1;
    this.out(a().reset().cls().k(15, "TELEWIRE v2.1").k(7, " — terminal mode").nl(2));
    this.out(a().k(7, "ATZ").nl()); await this.wait(350 * t); this.alive(g);
    this.out(a().k(7, "OK").nl()); await this.wait(250 * t); this.alive(g);
    this.hints.set([{ label: "ESC skip", key: "Escape" }]);
    const known = !!boardAt(entry.number);
    for (let attempt = 0; ; attempt++) {
      this.out(a().k(7, `ATDT ${entry.number}`).nl());
      audio.emit("offHook");
      await this.wait(600 * t); this.alive(g);
      for (const d of entry.number.replace(/\D/g, "")) { audio.emit("dialDigit", d); if (!this.skipping) await this.wait((DTMF_ON_MS + DTMF_OFF_MS) * t); this.alive(g); }
      if (!known) { // nobody home: it just rings
        for (let r = 0; r < 4; r++) { await this.wait(r === 0 ? 900 * t : 2600 * t); this.alive(g); audio.emit("ring"); }
        await this.wait(2000); this.alive(g);
        this.out(a().k(7, "NO ANSWER").nl()); audio.emit("hangup");
        this.skipping = false; await this.sleep(1200); return;
      }
      const busy = attempt === 0 && !express && !this.lastBusy && (this.debug.busy ? this.callsThisPower === 0 : this.callsThisPower === 0 && Math.random() < 0.2);
      for (let r = 0; r < (busy ? 1 : 2); r++) { await this.wait(r === 0 ? 900 * t : 2600 * t); this.alive(g); if (!busy) audio.emit("ring"); }
      if (busy) {
        this.lastBusy = true;
        audio.emit("busy");
        await this.wait(1800); this.alive(g);
        this.out(a().k(7, "BUSY").nl());
        audio.emit("hangup");
        this.skipping = false;
        for (let n = 5; n > 0; n--) {
          this.hints.set([{ label: "SPACE redial now", key: " " }, { label: "ESC cancel", key: "Escape" }]);
          this.out(a().raw("\r").k(14, `Redialing in ${n} seconds... (ESC cancels)`).eol());
          const k = await this.keys.nextOr(this.sleep(1000)); this.alive(g);
          if (k?.key === "Escape") { this.out(a().nl().k(7, "Dial cancelled.").nl()); await this.sleep(700); return; }
          if (k?.key === " ") break;
        }
        this.out(a().nl());
        this.callsThisPower++;
        continue;
      }
      this.lastBusy = false;
      break;
    }
    this.callsThisPower++;
    this.state.set("handshake");
    audio.emit("handshakeStart", speed);
    await this.wait(handshakeMs(speed) * t); this.alive(g);
    this.out(a().k(15, `CONNECT ${speed}`).nl(2));
    audio.emit("connect", speed);
    count("connected");
    this.engine.modem.bps = speed;
    await this.session(entry, speed, g);
  }

  private async session(entry: DirEntry, speed: number, g: number) {
    this.state.set("session");
    const started = Date.now();
    this.lastInput = started; this.inactivityWarned = false;
    const node = 1;
    const term = this.engine.term;
    const modem = this.engine.modem;
    this.startTimer(started, g);
    const io: HostIO = {
      send: (b) => modem.write(b),
      key: () => this.keys.next(),
      keyOrDrain: () => this.keys.nextOr(modem.drain()),
      keyTimeout: (ms) => this.keys.nextOr(this.sleep(ms)),
      hint: (k) => this.hints.set(k),
      drain: () => modem.drain(),
      flush: () => modem.flush(),
      pause: () => modem.pause(),
      resume: () => modem.resume(),
      isPaused: () => modem.paused,
      clearOutput: () => modem.clear(),
      client: {
        setMode: (m) => { term.setMode(m); term.reset(); },
        scroll: (d) => term.scrollView(d),
        scrollTo: (w) => term.scrollViewTo(w === "top" ? term.scrollbackLines : 0),
        markTop: () => { /* scrollback starts fresh at each setMode/reset */ },
        overlay: (bytes) => {
          if (!bytes) this.boardOverlay = null;
          else { const ov = new Terminal({ cols: 80 }, { masked: true }); ov.feed(bytes); this.boardOverlay = ov; }
          this.applyOverlay();
        },
        artOpen: (on) => { this.artOpen = on; this.applyOverlay(); },
        rows: () => term.rows,
        disk: () => audio.emit("diskSeek"),
        saveDownload: (f) => { audio.emit("diskSeek"); return drive.put(f); },
        kplay: async (name, bytes) => { term.setMode({ cols: 80, ice: false, ninePixel: true }); term.reset(); await kplay(this.localEnv(), name, bytes); },
      },
      speed, node, entry, profile: this.profile,
      save: () => saveProfile(this.profile),
      timeLeftMs: () => Math.max(0, this.callMinutes * 60000 - (Date.now() - started)),
      deepLink: this.deepLink ?? undefined,
    };
    this.deepLink = null;
    try {
      await runBoard(io);
      await modem.drain();
    } catch (e) {
      if (!(e instanceof Aborted) || e.reason === "power") throw e;
    } finally {
      this.stopTimer();
    }
    this.alive(g);
    this.keys.revive();
    this.state.set("hangup");
    modem.clear(); modem.resume();
    this.boardOverlay = null; this.artOpen = false;
    term.overlay = null;
    term.setMode({ cols: 80, ice: false, ninePixel: true });
    this.hints.set([]);
    this.out(a().reset().nl(2).k(7, "NO CARRIER").nl());
    audio.emit("hangup");
    const d = new Date();
    this.profile.lastCall[entry.number] = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-93 ${d.toTimeString().slice(0, 5)}`;
    this.profile.calls++;
    saveProfile(this.profile);
    this.skipping = false;
    await this.wait(1600); this.alive(g);
  }

  private startTimer(started: number, g: number) {
    this.stopTimer();
    this.timeTimer = setInterval(() => {
      if (g !== this.gen) return this.stopTimer();
      const idle = Date.now() - this.lastInput;
      if (idle >= Machine.HANGUP_MS) {
        this.boardOverlay=null;this.artOpen=false;this.engine.term.overlay=null;
        this.engine.modem.resume(); this.engine.modem.clear();
        this.engine.modem.write(a().reset().cls().at(10,8).k(12,"Five minutes without a key. Static needs the line.").at(12,8).k(7,"Call back when you're at the keyboard. NO CARRIER.").build());
        this.stopTimer(); setTimeout(() => { if(g===this.gen) this.keys.abort("idle"); },2500); return;
      }
      if (idle >= Machine.WARNING_MS && !this.inactivityWarned) {
        this.inactivityWarned=true;
        this.engine.modem.write(a().at(25,1).k(14,"Still there? Press a key; the line drops in one minute.").build());
      }
      if (Date.now() - started >= this.callMinutes * 60000) { this.stopTimer(); this.keys.abort("timeup"); }
    }, 1000);
  }
  private stopTimer() { if (this.timeTimer) clearInterval(this.timeTimer); this.timeTimer = null; }
}

export { center };
