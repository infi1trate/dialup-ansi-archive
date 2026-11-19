// The synth: every sound in the room, generated with Web Audio. Loaded lazily on the first
// power click. Subscribes to the bus; never reads machine state directly.
import type { audio as Bus } from "./bus";
import { BUSY, DIAL_TONE, DTMF, DTMF_OFF_MS, DTMF_ON_MS, RINGBACK, handshakeMs } from "./tables";
import {introNote,noteFrequency,INTRO_STEP} from './intro-score';

type B = typeof Bus;
type Src = AudioScheduledSourceNode;

/** Pan positions of the objects in the shot (-1 left .. 1 right). */
const PAN = { window: -0.72, lamp: -0.7, pc: 0, monitor: -0.04, keyboard: 0.02, modem: 0.62, speakerL: 0.48, speakerR: 0.48 };

let started = false;
export function startSynth(ctx: AudioContext, bus: B) {
  if (started) return;
  started = true;
  new Synth(ctx, bus);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

class Synth {
  master: GainNode;
  buses: Record<"room" | "pc" | "monitor" | "keyboard" | "modem", GainNode>;
  white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer; crackle: AudioBuffer;
  modemIn: GainNode; modemVol: GainNode; musicVol: GainNode;
  line: Src[] = [];
  private printerTimer:ReturnType<typeof setInterval>|undefined;
  private introTimer: ReturnType<typeof setInterval> | undefined;
  private introSources: OscillatorNode[]=[];
  private introGain: GainNode | null=null;
  fan: GainNode | null = null;
  hdd: { osc: OscillatorNode[]; gain: GainNode } | null = null;

  constructor(private ctx: AudioContext, private bus: B) {
    const c = ctx;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    limiter.connect(c.destination);
    bus.tapNode = limiter;
    this.master = c.createGain();
    this.master.connect(limiter);
    const verb = c.createConvolver();
    verb.buffer = this.impulse(0.7);
    const wet = c.createGain(); wet.gain.value = 0.16;
    verb.connect(wet).connect(this.master);

    const mk = (pan: number, g = 1) => {
      const gain = c.createGain(); gain.gain.value = g;
      const p = c.createStereoPanner(); p.pan.value = pan;
      gain.connect(p); p.connect(this.master); p.connect(verb);
      return gain;
    };
    this.buses = { room: mk(0, 1), pc: mk(PAN.pc), monitor: mk(PAN.monitor), keyboard: mk(PAN.keyboard), modem: mk(PAN.modem) };

    this.white = this.noise("white"); this.pink = this.noise("pink"); this.brown = this.noise("brown");
    this.crackle = this.makeCrackle();

    // modem speaker: tiny cone, 400-3400 Hz, slightly overdriven
    this.modemIn = c.createGain(); this.modemIn.gain.value = 0.9;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    shaper.curve = curve;
    const hp1 = this.biquad("highpass", 400, 0.7), hp2 = this.biquad("highpass", 400, 0.7);
    const lp1 = this.biquad("lowpass", 3400, 0.7), lp2 = this.biquad("lowpass", 3400, 0.7);
    const peak = this.biquad("peaking", 1700, 1.2); peak.gain.value = 5;
    this.modemVol = c.createGain();
    this.modemIn.connect(shaper).connect(hp1).connect(hp2).connect(lp1).connect(lp2).connect(peak).connect(this.modemVol).connect(this.buses.modem);

    // The single photographed speaker receives both tracker channels.
    this.musicVol = c.createGain();
    const mhp = this.biquad("highpass", 140, 0.8), mlp = this.biquad("lowpass", 7500, 0.7), mpk = this.biquad("peaking", 2600, 1.1); mpk.gain.value = 4;
    const split = c.createChannelSplitter(2);
    this.musicVol.connect(mhp).connect(mpk).connect(mlp).connect(split);
    const spk = (ch: number, pan: number) => { const g = c.createGain(); const p = c.createStereoPanner(); p.pan.value = pan; split.connect(g, ch); g.connect(p); p.connect(this.master); p.connect(verb); };
    spk(0, PAN.speakerL); spk(1, PAN.speakerR);
    bus.on("musicSource", (n) => n.connect(this.musicVol));
    if (bus.musicNode) bus.musicNode.connect(this.musicVol);
    this.applyMix();
    bus.on("mix", () => this.applyMix());
    bus.on("powerOn", () => this.pcOn());
    bus.on("powerOff", () => this.pcOff());
    bus.on("monitorOn", () => this.monitorOn());
    bus.on("monitorOff", () => this.monitorOff());
    bus.on("keyDown", (k) => this.keyDown(k));
    bus.on("keyUp", (k) => this.keyUp(k));
    bus.on("beep", () => this.beep());
    let motor: { src: AudioBufferSourceNode; osc: OscillatorNode; gain: GainNode } | null = null;
    bus.on("tapeMotor", (on) => {
      if (motor) { const m = motor; motor = null; m.gain.gain.setTargetAtTime(0, this.now, 0.05); setTimeout(() => { try { m.src.stop(); m.osc.stop(); } catch { /* stopped */ } }, 300); }
      if (!on) return;
      const src = c.createBufferSource(); src.buffer = this.brown; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 180; lp.Q.value = 1.4;
      const osc = c.createOscillator(); osc.frequency.value = 52; const og = c.createGain(); og.gain.value = 0.25;
      const gain = c.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(0.05, this.now, 0.08);
      src.connect(lp).connect(gain); osc.connect(og).connect(gain); gain.connect(this.buses.pc);
      src.start(); osc.start(); motor = { src, osc, gain };
    });
    bus.on("printer",(on)=>{clearInterval(this.printerTimer);if(on){let n=0;this.printerTimer=setInterval(()=>{this.tones([900+(n%7)*130],this.now,.035,.04,this.buses.pc);if(++n>=60)clearInterval(this.printerTimer);},35);}});
    bus.on("degauss", (kind) => this.degauss(kind));
    bus.on("diskSeek", () => this.diskSeek());
    bus.on("floppySeek", () => this.floppySeek());
    bus.on("printScreen", (sec) => this.printScreen(sec));
    bus.on("floppyInsert", () => this.floppyLatch(false));
    bus.on("floppyEject", () => this.floppyLatch(true));
    bus.on("offHook", () => this.offHook());
    bus.on("programTone", (p) => this.tones([p.frequency], this.now, p.duration, 0.12, p.speaker === "music" ? this.musicVol : this.modemIn));
    bus.on('introMusic',(on)=>this.intro(on));
    bus.on('powerOff',()=>this.intro(false));
    bus.on("dialDigit", (d) => this.digit(d));
    bus.on("ring", () => this.ringback());
    bus.on("busy", () => this.busy());
    bus.on("handshakeStart", (s) => this.handshake(s));
    bus.on("connect", () => this.cutLine());
    bus.on("hangup", () => { this.cutLine(); this.relay(); });
    // No staircase exists in the photographed room; the old automatic creak has no source.
    bus.on("lampToggle", () => this.switchClick(PAN.lamp, 0.5));

    this.roomTone();
    if (bus.status.pc) this.pcOn(true);
  }

  // ── building blocks ────────────────────────────────────────────
  private intro(on:boolean){
    clearInterval(this.introTimer);this.introTimer=undefined;
    this.introGain?.disconnect();this.introGain=null;
    for(const source of this.introSources){try{source.stop();}catch{}}this.introSources=[];
    if(!on)return;
    const dest=this.gain(1);dest.connect(this.musicVol);this.introGain=dest;
    let step=0;
    const play=()=>{const notes=introNote(step++),t=this.now;
      for(const [voice,note] of Object.entries(notes)){
        const osc=this.osc(voice==='bass'?'triangle':'square',noteFrequency(note)),gain=this.gain();
        osc.connect(gain).connect(dest);this.env(gain.gain,t,voice==='bass'?.14:.045,.004,INTRO_STEP*.8);
        osc.start(t);osc.stop(t+INTRO_STEP);this.introSources.push(osc);
        osc.onended=()=>{this.introSources=this.introSources.filter(s=>s!==osc);osc.disconnect();gain.disconnect();};
      }
    };
    play();this.introTimer=setInterval(play,INTRO_STEP*1000);
  }
  get now() { return this.ctx.currentTime; }
  biquad(type: BiquadFilterType, f: number, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  osc(type: OscillatorType, f: number) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  buf(b: AudioBuffer, loop = false, offset = Math.random() * 1.5) {
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = loop;
    (s as any)._off = loop ? offset : 0;
    return s;
  }
  start(s: Src, t: number, stop?: number) { (s as AudioBufferSourceNode).start(t, (s as any)._off ?? 0); if (stop !== undefined) s.stop(stop); return s; }
  panner(p: number) { const n = this.ctx.createStereoPanner(); n.pan.value = p; return n; }

  noise(kind: "white" | "pink" | "brown") {
    const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "pink") { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }
  makeCrackle() {
    const len = this.ctx.sampleRate * 1.2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const fade = 1 - i / len;
      d[i] = Math.random() < 0.0016 * fade * fade ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.02 * fade;
    }
    return b;
  }
  impulse(sec: number) {
    const len = Math.floor(this.ctx.sampleRate * sec), b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 40 ? i / 40 : 1);
    }
    return b;
  }
  /** Short envelope on a gain param. */
  env(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  burst(dest: AudioNode, t: number, dur: number, f: number, q: number, level: number, type: BiquadFilterType = "bandpass") {
    const s = this.buf(this.white, false); const f1 = this.biquad(type, f, q); const g = this.gain();
    s.connect(f1).connect(g).connect(dest);
    this.env(g.gain, t, level, 0.0006, dur);
    this.start(s, t, t + dur + 0.02);
  }

  applyMix() {
    const m = this.bus.mix, t = this.now;
    this.master.gain.setTargetAtTime(m.muted ? 0 : 0.9, t, 0.03);
    this.modemVol.gain.setTargetAtTime(m.modemVolume * m.modemVolume * 1.6, t, 0.03);
    this.musicVol.gain.setTargetAtTime(m.musicVolume * m.musicVolume * 1.4, t, 0.03);
  }

  // ── room ───────────────────────────────────────────────────────
  roomTone() {
    const c = this.ctx, t = this.now + 0.05, room = this.buses.room;
    const rumble = this.buf(this.brown, true), lp = this.biquad("lowpass", 110, 0.5), rg = this.gain();
    rumble.connect(lp).connect(rg).connect(room);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.09, t + 3);
    this.start(rumble, t);
    const hum = this.gain(0);
    hum.gain.linearRampToValueAtTime(0.006, t + 2);
    hum.connect(room);
    [[60, 1], [120, 0.55], [180, 0.2]].forEach(([f, a]) => { const o = this.osc("sine", f); const g = this.gain(a); o.connect(g).connect(hum); o.start(t); });
    // rain on the window glass
    const rain = this.buf(this.white, true), bp = this.biquad("bandpass", 2600, 0.45), hp = this.biquad("highpass", 700), rainG = this.gain(0);
    rain.connect(bp).connect(hp).connect(rainG).connect(this.panner(PAN.window)).connect(room);
    this.start(rain, t);
    const patter = this.buf(this.pink, true), pbp = this.biquad("bandpass", 900, 0.8), pg = this.gain(0.012);
    patter.connect(pbp).connect(pg).connect(rainG);
    this.start(patter, t);
    const swell = () => { rainG.gain.setTargetAtTime(rnd(0.012, 0.05), this.now, rnd(1.5, 4)); setTimeout(swell, rnd(3000, 8000)); };
    rainG.gain.setValueAtTime(0, t); rainG.gain.linearRampToValueAtTime(0.03, t + 4);
    setTimeout(swell, 4000);
    const creak = () => { this.creak(); setTimeout(creak, rnd(40000, 120000)); };
    setTimeout(creak, rnd(25000, 60000));
    void c;
  }
  creak(pan?: number) {
    const t = this.now + 0.05, dur = rnd(0.7, 1.4);
    const o = this.osc("sawtooth", rnd(22, 34));
    o.frequency.setValueAtTime(o.frequency.value, t);
    o.frequency.linearRampToValueAtTime(rnd(12, 20), t + dur);
    const b1 = this.biquad("bandpass", rnd(500, 750), 14), b2 = this.biquad("bandpass", rnd(1100, 1500), 10), g = this.gain();
    o.connect(b1).connect(g); o.connect(b2).connect(g);
    g.connect(this.panner(pan ?? 0.85)).connect(this.buses.room);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ── PC ─────────────────────────────────────────────────────────
  switchClick(pan: number, level: number) {
    const t = this.now, p = this.panner(pan); p.connect(this.buses.room);
    this.burst(p, t, 0.012, 2400, 3, level * 0.5);
    this.burst(p, t + 0.004, 0.03, 380, 4, level * 0.6);
  }
  pcOn(late = false) {
    const t = this.now, pc = this.buses.pc;
    if (!late) { this.burst(pc, t, 0.015, 2000, 2, 0.35); this.burst(pc, t + 0.005, 0.05, 220, 3, 0.4); }
    // fan
    const fan = this.buf(this.pink, true), b = this.biquad("bandpass", 320, 0.45), lp = this.biquad("lowpass", 1400), g = this.gain(0);
    fan.connect(b).connect(lp).connect(g).connect(pc);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 1.6);
    this.start(fan, t);
    this.fan = g;
    (g as any)._src = fan;
    // hard disk spindle
    const hg = this.gain(0); hg.connect(pc);
    const oscs = [[90, 0.05, "sine"], [180, 0.012, "triangle"], [5400, 0.0012, "sine"]].map(([f, a, type]) => {
      const o = this.osc(type as OscillatorType, f as number); const og = this.gain(a as number); o.connect(og).connect(hg);
      o.frequency.setValueAtTime((f as number) * 0.08, t); o.frequency.exponentialRampToValueAtTime(f as number, t + 3);
      o.start(t); return o;
    });
    hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(1, t + 2.5);
    this.hdd = { osc: oscs, gain: hg };
  }
  pcOff() {
    const t = this.now, pc = this.buses.pc;
    this.burst(pc, t, 0.015, 1800, 2, 0.3); this.burst(pc, t + 0.005, 0.05, 200, 3, 0.35);
    this.cutLine();
    if (this.fan) { const f = this.fan; f.gain.cancelScheduledValues(t); f.gain.setValueAtTime(f.gain.value, t); f.gain.linearRampToValueAtTime(0, t + 2.2); (f as any)._src.stop(t + 2.3); this.fan = null; }
    if (this.hdd) {
      const h = this.hdd; this.hdd = null;
      h.osc.forEach((o) => { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.06, t + 4); o.stop(t + 4.1); });
      h.gain.gain.cancelScheduledValues(t); h.gain.gain.setValueAtTime(h.gain.gain.value, t); h.gain.gain.linearRampToValueAtTime(0, t + 4);
    }
  }
  diskSeek() {
    if (!this.bus.status.pc) return;
    let t = this.now + 0.005;
    const n = 3 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      this.burst(this.buses.pc, t, 0.004, rnd(2400, 3600), 9, rnd(0.25, 0.45));
      this.burst(this.buses.pc, t, 0.01, rnd(300, 420), 6, rnd(0.08, 0.15));
      t += rnd(0.015, 0.06);
    }
  }
  private printOut: GainNode | null = null;
  /** The 9-pin printer under the desk (right, low and muffled): needle passes line by line, carriage thunks, paper feed. */
  printScreen(sec: number) {
    const t = this.now;
    if (this.printOut) { const o = this.printOut; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.05); setTimeout(() => o.disconnect(), 200); this.printOut = null; }
    if (sec <= 0) return;
    const out = this.gain(1), lp = this.biquad("lowpass", 2600, 0.7), p = this.panner(0.72);
    out.connect(lp).connect(p).connect(this.buses.room); this.printOut = out;
    const lines = Math.round(sec / 0.14);
    for (let i = 0; i < lines; i++) {
      const l0 = t + 0.02 + i * 0.14, pass = i % 2 ? 0.085 : 0.1;
      for (let k = 0; k * 0.0042 < pass; k++) if (Math.random() < 0.78) this.burst(out, l0 + k * 0.0042, 0.0025, rnd(2100, 3300), 7, rnd(0.08, 0.16));
      this.burst(out, l0 + pass + 0.006, 0.03, rnd(150, 210), 3, 0.32);
      this.burst(out, l0 + pass + 0.02, 0.02, 900, 2, 0.05);
    }
  }
  /** Shutter slide and latch clack going in; the eject button's clunk and spring coming out. */
  floppyLatch(eject: boolean) {
    const t = this.now + 0.005, d = this.buses.pc;
    if (eject) { this.burst(d, t, 0.03, 380, 3, 0.55); this.burst(d, t + 0.012, 0.012, 1900, 5, 0.22); this.burst(d, t + 0.07, 0.05, 2600, 2, 0.06); return; }
    this.burst(d, t, 0.09, 3200, 1.5, 0.05); this.burst(d, t + 0.1, 0.012, 1400, 6, 0.3); this.burst(d, t + 0.105, 0.025, 300, 4, 0.35);
  }
  floppySeek() {
    let t = this.now + 0.01;
    const dest = this.biquad("lowpass", 1100, 1); dest.connect(this.buses.pc);
    const steps = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < steps; i++) {
      const o = this.osc("sawtooth", rnd(65, 120)), g = this.gain();
      o.connect(g).connect(dest);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.005); g.gain.setValueAtTime(0.09, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.04);
      o.start(t); o.stop(t + 0.05);
      this.burst(this.buses.pc, t, 0.006, 1500, 4, 0.08);
      t += rnd(0.05, 0.075);
    }
  }
  beep() {
    const t = this.now, o = this.osc("square", 880), bp = this.biquad("bandpass", 1900, 0.8), hp = this.biquad("highpass", 350), g = this.gain();
    o.connect(hp).connect(bp).connect(g).connect(this.buses.pc);
    g.gain.setValueAtTime(0.18, t); g.gain.setValueAtTime(0.18, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.16);
    o.start(t); o.stop(t + 0.17);
  }

  // ── monitor ────────────────────────────────────────────────────
  thunk(level: number) {
    const t = this.now, m = this.buses.monitor;
    const o = this.osc("sine", 85), g = this.gain(); o.connect(g).connect(m);
    o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    this.env(g.gain, t, level, 0.004, 0.25); o.start(t); o.stop(t + 0.3);
    this.burst(m, t, 0.01, 2600, 2, level * 0.5);
  }
  monitorOn() {
    this.thunk(0.5);
    const t = this.now + 0.06, m = this.buses.monitor;
    // degauss: two mains harmonics beating together, decaying with a wobble
    const g = this.gain(); g.connect(m);
    const lfo = this.osc("sine", 6), lg = this.gain(0.06); lfo.connect(lg).connect(g.gain);
    [[100, 0.35, "sine"], [120, 0.3, "sine"], [60, 0.12, "sawtooth"], [240, 0.05, "triangle"]].forEach(([f, a, type]) => {
      const o = this.osc(type as OscillatorType, f as number), og = this.gain(a as number);
      o.connect(og).connect(g); o.frequency.setValueAtTime(f as number, t); o.frequency.linearRampToValueAtTime((f as number) * 0.97, t + 0.85);
      o.start(t); o.stop(t + 0.95);
    });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.002, t + 0.85);
    lfo.start(t); lfo.stop(t + 0.95);
    // static crackle as the tube charges
    const s = this.buf(this.crackle), hp = this.biquad("highpass", 1800), cg = this.gain(0.5);
    s.connect(hp).connect(cg).connect(m); this.start(s, t + 0.2);
  }
  /** Deep thunk of the relay, then the coil's 60 Hz hum decaying over about 1.6 s. */
  degauss(kind: "full" | "click" | "reduced") {
    const m = this.buses.monitor, t = this.now;
    if (kind === "click") { this.burst(m, t, 0.012, 900, 3, 0.18); this.burst(m, t + 0.003, 0.03, 260, 4, 0.12); return; }
    const o = this.osc("sine", 70), g = this.gain(); o.connect(g).connect(m);
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    this.env(g.gain, t, 0.95, 0.003, 0.4); o.start(t); o.stop(t + 0.45);
    this.burst(m, t, 0.02, 420, 2, 0.5); this.burst(m, t, 0.008, 2200, 2, 0.25);
    if (kind === "reduced") return;
    const hum = this.gain(); hum.connect(m);
    [[60, 0.5, "sawtooth"], [120, 0.35, "sine"], [180, 0.12, "triangle"]].forEach(([f, a, type]) => {
      const h = this.osc(type as OscillatorType, f as number), hg = this.gain(a as number); h.connect(hg).connect(hum);
      h.start(t + 0.02); h.stop(t + 1.75);
    });
    const lp = this.biquad("lowpass", 900, 0.7); hum.disconnect(); hum.connect(lp).connect(m);
    hum.gain.setValueAtTime(0, t); hum.gain.linearRampToValueAtTime(0.42, t + 0.04); hum.gain.exponentialRampToValueAtTime(0.002, t + 1.65);
  }
  monitorOff() {
    this.thunk(0.35);
    const t = this.now, o = this.osc("sine", 9000), g = this.gain();
    o.connect(g).connect(this.buses.monitor);
    o.frequency.setValueAtTime(9000, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.55);
    this.env(g.gain, t, 0.025, 0.01, 0.55); o.start(t); o.stop(t + 0.6);
  }

  // ── keyboard (buckling spring) ─────────────────────────────────
  keyDown(k: string) {
    const t = this.now, kb = this.buses.keyboard, r = rnd(0.95, 1.05), lv = rnd(0.92, 1.08);
    const deep = k === " " || k === "Enter";
    this.burst(kb, t, 0.004, 3600 * r, 1.2, 0.5 * lv, "highpass");
    const o = this.osc("triangle", (deep ? 92 : 150) * r), g = this.gain(); o.connect(g).connect(kb);
    o.frequency.setValueAtTime((deep ? 92 : 150) * r, t); o.frequency.exponentialRampToValueAtTime((deep ? 60 : 95) * r, t + 0.06);
    this.env(g.gain, t, (deep ? 0.55 : 0.4) * lv, 0.002, deep ? 0.1 : 0.06); o.start(t); o.stop(t + 0.13);
    this.burst(kb, t + 0.001, deep ? 0.05 : 0.03, (deep ? 500 : 800) * r, 2, 0.25 * lv);
    // spring ping
    const p = this.osc("sine", 3100 * r), p2 = this.osc("sine", 4470 * r), pg = this.gain();
    p.connect(pg); p2.connect(pg); pg.connect(kb);
    this.env(pg.gain, t + 0.003, 0.03 * lv, 0.001, 0.09); p.start(t); p2.start(t); p.stop(t + 0.12); p2.stop(t + 0.12);
  }
  keyUp(k: string) {
    const t = this.now, kb = this.buses.keyboard, r = rnd(0.95, 1.05);
    const deep = k === " " || k === "Enter";
    this.burst(kb, t, 0.003, 5200 * r, 1.5, 0.22, "highpass");
    this.burst(kb, t, 0.02, (deep ? 700 : 1300) * r, 3, 0.12);
  }

  // ── modem ──────────────────────────────────────────────────────
  cutLine() { const t = this.now; this.line.forEach((s) => { try { s.stop(t); } catch { /* not started */ } }); this.line = []; }
  relay() {
    const t = this.now;
    this.burst(this.buses.modem, t, 0.006, 2000, 3, 0.35);
    this.burst(this.buses.modem, t + 0.018, 0.006, 1700, 3, 0.25);
  }
  tones(freqs: number[], t: number, dur: number, level: number, dest: AudioNode = this.modemIn) {
    const g = this.gain(); g.connect(dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.006);
    g.gain.setValueAtTime(level, t + Math.max(0.006, dur - 0.006)); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const f of freqs) { const o = this.osc("sine", f); o.connect(g); o.start(t); o.stop(t + dur + 0.01); this.line.push(o); }
    return g;
  }
  offHook() {
    this.cutLine(); this.relay();
    const t = this.now + 0.12;
    this.tones(DIAL_TONE, t, 30, 0.22);
    this.dialToneActive = true; this.nextDigit = 0;
  }
  digit(d: string) {
    const pair = DTMF[d]; if (!pair) return;
    if (this.line.length && this.dialToneActive) { this.cutLine(); this.dialToneActive = false; }
    const t = Math.max(this.now, this.nextDigit);
    this.tones(pair, t, DTMF_ON_MS / 1000, 0.25);
    this.nextDigit = t + (DTMF_ON_MS + DTMF_OFF_MS) / 1000;
  }
  dialToneActive = false;
  nextDigit = 0;
  ringback() { this.tones(RINGBACK, this.now, 2, 0.16); }
  busy() {
    const t = this.now;
    for (let i = 0; i < 12; i++) this.tones(BUSY, t + i, 0.5, 0.2);
  }
  sweep(f0: number, f1: number, t: number, dur: number, level: number, type: OscillatorType = "sine") {
    const o = this.osc(type, f0), g = this.gain(); o.connect(g).connect(this.modemIn);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.01); g.gain.setValueAtTime(level, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.01); this.line.push(o);
  }
  warble(fa: number, fb: number, rate: number, t: number, dur: number, level: number) {
    const o = this.osc("sine", fa), g = this.gain(); o.connect(g).connect(this.modemIn);
    const step = 1 / rate;
    for (let x = 0, i = 0; x < dur; x += step, i++) o.frequency.setValueAtTime(i % 2 ? fb : fa, t + x);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.01); g.gain.setValueAtTime(level, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.01); this.line.push(o);
  }
  answer(t: number, dur: number, opts: { reversals?: boolean; ansam?: boolean }) {
    const g = this.tones([2100], t, dur, 0.22);
    if (opts.reversals) for (let x = 0.45; x < dur - 0.1; x += 0.45) { g.gain.setValueAtTime(0.22, t + x - 0.004); g.gain.linearRampToValueAtTime(0.02, t + x); g.gain.linearRampToValueAtTime(0.22, t + x + 0.004); }
    if (opts.ansam) { const lfo = this.osc("sine", 15), lg = this.gain(0.05); lfo.connect(lg).connect(g.gain); lfo.start(t); lfo.stop(t + dur); this.line.push(lfo); }
  }
  hiss(t: number, dur: number, ripple: number, level: number, center = 1800) {
    const s = this.buf(this.white, true), bp = this.biquad("bandpass", center, 0.55), g = this.gain();
    s.connect(bp).connect(g).connect(this.modemIn);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.02);
    const lfo = this.osc("square", ripple), lg = this.gain(level * 0.3); lfo.connect(lg).connect(g.gain);
    const lfo2 = this.osc("sine", ripple * 0.37), lg2 = this.gain(level * 0.25); lfo2.connect(lg2).connect(g.gain);
    this.start(s, t, t + dur); lfo.start(t); lfo.stop(t + dur); lfo2.start(t); lfo2.stop(t + dur);
    this.line.push(s, lfo, lfo2);
    // a carrier buried in the noise
    this.tones([center * 0.98, center * 1.33], t, dur, level * 0.25);
  }
  bweeOoo(t: number) { this.sweep(1300, 2700, t, 0.16, 0.2); this.sweep(2700, 850, t + 0.16, 0.5, 0.2); }
  handshake(speed: number) {
    this.cutLine();
    const t = this.now + 0.05, T = handshakeMs(speed) / 1000;
    if (speed <= 2400) {
      this.answer(t, 1.3, {});
      this.tones([1200, 2400], t + 1.42, 0.9, 0.12);
      this.sweep(600, 600, t + 1.42, 0.9, 0.05, "sawtooth");
      this.hiss(t + 2.35, T - 2.35, 34, 0.32, 1500);
      this.sweep(300, 300, t + 2.35, T - 2.35, 0.04, "square");
    } else if (speed <= 14400) {
      const big = speed > 9600;
      this.answer(t, big ? 2.4 : 2.2, { reversals: true });
      let x = big ? 2.6 : 2.4;
      this.warble(1800, 600, 36, t + x, 0.8, 0.18); x += 0.85;
      this.bweeOoo(t + x); x += 0.72;
      if (big) { this.tones([1800, 600], t + x, 0.45, 0.14); x += 0.5; }
      this.hiss(t + x, T - x, big ? 18 : 23, 0.36);
    } else {
      this.answer(t, 2.0, { ansam: true });
      let x = 2.1;
      this.warble(980, 1180, 60, t + x, 0.35, 0.16); this.warble(1650, 1850, 60, t + x + 0.35, 0.35, 0.14); x += 0.85;
      for (let c = 0; c < 3; c++) {
        const base = 150 * (1 + c * 6); const fs: number[] = [];
        for (let k = 0; k < 7; k++) fs.push(base + k * 150);
        this.tones(fs, t + x, 0.42, 0.06); x += 0.48;
      }
      this.bweeOoo(t + x); x += 0.72;
      this.tones([1800, 600], t + x, 0.5, 0.12); x += 0.55;
      this.hiss(t + x, (T - x) * 0.5, 15, 0.32, 1600);
      this.hiss(t + x + (T - x) * 0.5, (T - x) * 0.5, 27, 0.38, 1900);
    }
  }
}
