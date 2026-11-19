// The mixtape's original chiptunes as note lists, plus a tiny synth that plays them into any AudioContext
// (live through the tape deck, or offline to a WAV for review). All original; no samples.
import { INTRO_BARS, INTRO_STEP, introNote, noteFrequency } from "./intro-score";

export type Instrument = "pulse" | "tri" | "arp" | "pad" | "kick" | "snare" | "hat";
export interface Note { t: number; midi: number; dur: number; inst: Instrument; vel: number }
export interface Tune { id: string; title: string; mood: string; notes: Note[]; length: number }

const tune = (id: string, title: string, mood: string, notes: Note[], length: number): Tune => ({ id, title, mood, notes, length });

/** LATCHKEY's cracktro score (the EMBER / CHROMA intro), as heard in the warez programs. */
function latchkey(): Tune {
  const n: Note[] = [], steps = INTRO_BARS * 8 * 2;
  for (let s = 0; s < steps; s++) { const v = introNote(s), t = s * INTRO_STEP; n.push({ t, midi: v.bass, dur: INTRO_STEP * 0.8, inst: "tri", vel: 0.9 }, { t, midi: v.lead, dur: INTRO_STEP * 0.8, inst: "pulse", vel: 0.5 }); }
  return tune("latchkey", "LATCHKEY intro", "cracktro", n, steps * INTRO_STEP + 0.4);
}
/** The eight-note loop the other warez intros beep, given a bass line and a little air. */
function releaseLoop(): Tune {
  const freqs = [220, 277, 330, 440, 330, 277, 247, 330], midi = freqs.map((f) => Math.round(69 + 12 * Math.log2(f / 440)));
  const n: Note[] = [], step = 0.15, loops = 26;
  for (let i = 0; i < loops * 8; i++) { const t = i * step; n.push({ t, midi: midi[i % 8], dur: 0.12, inst: "arp", vel: 0.55 }); if (i % 8 === 0) n.push({ t, midi: 45 - (Math.floor(i / 32) % 2) * 2, dur: step * 7.5, inst: "tri", vel: 0.8 }); if (i >= 64 && i % 4 === 0) n.push({ t, midi: 0, dur: 0.05, inst: "hat", vel: 0.35 }); }
  return tune("loop", "Release loop", "warez", n, loops * 8 * step + 0.4);
}
/** Slow arpeggio: four major-seventh chords, 76 BPM, eighth-note arps over a soft pad. */
function basementLamp(): Tune {
  const step = 60 / 76 / 2, chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], pat = [0, 1, 2, 3, 4, 3, 2, 1];
  const n: Note[] = []; const bars = 16;
  for (let b = 0; b < bars; b++) {
    const ch = chords[b % 4], t0 = b * 8 * step, up = b >= 8 ? 12 : 0;
    n.push({ t: t0, midi: ch[0] - 12, dur: 8 * step * 0.95, inst: "tri", vel: 0.7 });
    ch.forEach((m) => n.push({ t: t0, midi: m, dur: 8 * step, inst: "pad", vel: 0.16 }));
    pat.forEach((p, i) => n.push({ t: t0 + i * step, midi: (p === 4 ? ch[0] + 12 : ch[p]) + up, dur: step * 1.6, inst: "arp", vel: 0.42 }));
  }
  n.push({ t: bars * 8 * step, midi: 53, dur: 3, inst: "pad", vel: 0.18 }, { t: bars * 8 * step, midi: 41, dur: 3, inst: "tri", vel: 0.6 });
  return tune("lamp", "Basement Lamp", "slow arpeggio", n, bars * 8 * step + 3.2);
}
/** Upbeat: I-V-vi-IV at 140 BPM with a drum kit, octave bass and a bouncing lead. */
function turboButton(): Tune {
  const step = 60 / 140 / 4, roots = [48, 43, 45, 41], lead = [[72, 76, 79, 76], [71, 74, 79, 74], [72, 76, 81, 76], [72, 77, 81, 77]], rhythm = [0, 3, 6, 8, 10, 12, 14];
  const n: Note[] = []; const bars = 24;
  for (let b = 0; b < bars; b++) {
    const c = b % 4, t0 = b * 16 * step, intro = b < 2, outro = b >= bars - 1;
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * step;
      if (s % 2 === 0) n.push({ t, midi: roots[c] - 12 + (s % 4 === 2 ? 12 : 0), dur: step * 1.7, inst: "tri", vel: 0.85 });
      if (!intro) { if (s % 8 === 0) n.push({ t, midi: 0, dur: 0.2, inst: "kick", vel: 0.9 }); if (s % 8 === 4) n.push({ t, midi: 0, dur: 0.15, inst: "snare", vel: 0.6 }); if (s % 2 === 1) n.push({ t, midi: 0, dur: 0.04, inst: "hat", vel: 0.3 }); }
    }
    if (!intro && !outro) rhythm.forEach((s, i) => n.push({ t: t0 + s * step, midi: lead[c][i % 4] + (b >= 12 && b < 20 ? 12 : 0) - (i === 6 ? 2 : 0), dur: step * (i === 6 ? 2 : 1.6), inst: "pulse", vel: 0.42 }));
    if (b % 2 === 1) [0, 4, 8, 12].forEach((s, i) => n.push({ t: t0 + s * step, midi: roots[c] + [12, 16, 19, 24][i], dur: step * 0.9, inst: "arp", vel: 0.25 }));
  }
  n.push({ t: bars * 16 * step, midi: 48, dur: 1.2, inst: "pulse", vel: 0.4 }, { t: bars * 16 * step, midi: 0, dur: 0.3, inst: "kick", vel: 0.9 });
  return tune("turbo", "Turbo Button", "upbeat", n, bars * 16 * step + 1.6);
}
/** Moody minor: D harmonic minor, 92 BPM, slow pulse melody with vibrato over a pad and a sparse kick. */
function carrierLost(): Tune {
  const step = 60 / 92 / 2, roots = [50, 46, 43, 45], pads = [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];
  const melody = [[74, -1, 72, 69, -1, 65, 67, -1], [70, -1, 69, 65, -1, 62, -1, -1], [67, -1, 70, 74, -1, 72, 70, -1], [69, -1, 73, 76, -1, 73, 69, -1]];
  const n: Note[] = []; const bars = 16;
  for (let b = 0; b < bars; b++) {
    const c = b % 4, t0 = b * 8 * step;
    pads[c].forEach((m) => n.push({ t: t0, midi: m, dur: 8 * step, inst: "pad", vel: 0.15 }));
    n.push({ t: t0, midi: roots[c] - 12, dur: 3 * step, inst: "tri", vel: 0.8 }, { t: t0 + 3 * step, midi: roots[c] - 12, dur: step, inst: "tri", vel: 0.6 }, { t: t0 + 6 * step, midi: roots[c] - 5, dur: 2 * step, inst: "tri", vel: 0.6 });
    if (b >= 2) { n.push({ t: t0, midi: 0, dur: 0.25, inst: "kick", vel: 0.7 }); n.push({ t: t0 + 4 * step, midi: 0, dur: 0.2, inst: "snare", vel: 0.32 }); }
    if (b >= 4) melody[c].forEach((m, i) => { if (m < 0) return; const held = melody[c][i + 1] === -1 ? 2 : 1; n.push({ t: t0 + i * step, midi: m + (b >= 12 ? -12 : 0), dur: step * held * 0.95, inst: "pulse", vel: 0.38 }); });
  }
  n.push({ t: bars * 8 * step, midi: 50, dur: 3.5, inst: "pad", vel: 0.18 }, { t: bars * 8 * step, midi: 38, dur: 3.5, inst: "tri", vel: 0.7 });
  return tune("carrier", "Carrier Lost", "moody minor", n, bars * 8 * step + 3.8);
}

export const TUNES: Record<string, Tune> = Object.fromEntries([latchkey(), basementLamp(), turboButton(), carrierLost(), releaseLoop()].map((t) => [t.id, t]));
/** The three new pieces written for the mixtape. */
export const NEW_TUNES = ["lamp", "turbo", "carrier"] as const;

/** Play notes [from, to) seconds of a tune into dest, starting the tune at context time t0. Returns the sources made. */
export function scheduleTune(ctx: BaseAudioContext, dest: AudioNode, tune: Tune, t0: number, from = 0, to = Infinity, noise?: AudioBuffer) {
  const made: AudioScheduledSourceNode[] = [];
  const nb = noise ?? noiseBuffer(ctx);
  for (const n of tune.notes) {
    if (n.t < from || n.t >= to) continue;
    const t = t0 + n.t, g = ctx.createGain(); g.gain.value = 0; g.connect(dest);
    const env = (peak: number, a: number, hold: number, rel: number) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, hold)); g.gain.linearRampToValueAtTime(0, t + Math.max(a, hold) + rel); return t + Math.max(a, hold) + rel + 0.02; };
    const osc = (type: OscillatorType, f: number, end: number, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); o.stop(end); made.push(o); return o; };
    const f = noteFrequency(n.midi);
    switch (n.inst) {
      case "pulse": { const end = env(0.16 * n.vel, 0.006, n.dur * 0.85, 0.06); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.connect(g); const o = osc("square", f, end); const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = n.dur > 0.4 ? 9 : 0; vib.connect(vg).connect(o.detune); vib.start(t); vib.stop(end); made.push(vib); o.connect(lp); break; }
      case "arp": { const end = env(0.11 * n.vel, 0.003, 0.02, n.dur); osc("square", f, end).connect(g); break; }
      case "tri": { const end = env(0.42 * n.vel, 0.004, n.dur * 0.8, 0.05); osc("triangle", f, end).connect(g); break; }
      case "pad": { const end = env(0.12 * n.vel, n.dur * 0.25, n.dur * 0.7, n.dur * 0.3); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(g); osc("sawtooth", f, end, -7).connect(lp); osc("sawtooth", f, end, 7).connect(lp); break; }
      case "kick": { const end = env(0.9 * n.vel, 0.002, 0.02, 0.22); const o = osc("sine", 130, end); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); o.connect(g); break; }
      case "snare": case "hat": {
        const end = env((n.inst === "hat" ? 0.12 : 0.3) * n.vel, 0.001, 0.005, n.inst === "hat" ? 0.04 : 0.14);
        const s = ctx.createBufferSource(); s.buffer = nb; const flt = ctx.createBiquadFilter(); flt.type = n.inst === "hat" ? "highpass" : "bandpass"; flt.frequency.value = n.inst === "hat" ? 7000 : 1800; s.connect(flt).connect(g); s.start(t, (n.t * 7.3) % 1); s.stop(end); made.push(s); break;
      }
    }
  }
  return made;
}
export function noiseBuffer(ctx: BaseAudioContext) { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let seed = 12345; for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; } return b; }

/** Render one tune dry (no tape, no hiss) to a 16-bit stereo WAV. Test/review hook. */
export async function renderTuneWav(id: string, sampleRate = 44100) {
  const t = TUNES[id]; if (!t) throw Error("no such tune");
  const ctx = new OfflineAudioContext(2, Math.ceil(t.length * sampleRate), sampleRate);
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  scheduleTune(ctx, master, t, 0);
  const buf = await ctx.startRendering();
  // normalise to -1 dBFS so every tune sits at the same level and none clips
  let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const k = peak > 0 ? 0.89 / peak : 1; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return wav(buf);
}
export function wav(buf: AudioBuffer) {
  const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
  return new Blob([out.buffer], { type: "audio/wav" });
}
