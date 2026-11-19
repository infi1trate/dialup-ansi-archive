// Audio event bus. Producers (machine, room) emit; the lazily loaded synth engine
// (src/audio/engine.ts) subscribes. The bus itself stays tiny so it can ship in the first frame.
export interface AudioEvents {
  printer: boolean;
  /** A floppy pushed into drive A: (latch clack), or ejected (clunk and spring). */
  /** PRINT SCREEN on the dot-matrix printer under the desk: seconds of printing, 0 = stop (skipped). */
  printScreen: number;
  /** The instant camera on the cork board: shutter clack, then the print motor. */
  camera: void;
  /** A click on the cassette stack: play or stop the mixtape. */
  mixtape: void;
  /** Mixtape status for the escape hatch: "stopped", or "A: Basement Lamp" style. */
  mixtapeState: string;
  floppyInsert: void;
  floppyEject: void;
  /** The monitor's degauss coil: a full cycle, the dull click of an uncharged coil, or the reduced-motion thunk. */
  degauss: "full" | "click" | "reduced";
  /** The PC's tape-drive motor while the ten-second tape records. */
  tapeMotor: boolean;
  introMusic: boolean;
  programTone: {frequency:number;duration:number;speaker:"modem"|"music"};
  powerOn: void; powerOff: void; keyDown: string; keyUp: string; beep: void;
  diskSeek: void; floppySeek: void; offHook: void; dialDigit: string; ring: void; busy: void;
  handshakeStart: number; connect: number; hangup: void; byteFlow: number;
  monitorOn: void; monitorOff: void; lampToggle: boolean; mix: void; stairCreak: void;
  /** Tracker output node to wire into the desk speakers; music = speakers playing or not. */
  musicSource: AudioNode; music: boolean;
}
type Handler<T> = (payload: T) => void;

export interface Mix { muted: boolean; modemVolume: number; musicVolume: number }

class AudioBus {
  private handlers: Record<string, Handler<any>[]> = {};
  private ctx: AudioContext | null = null;
  private loading = false;
  /** What is physically running right now, so a late-starting engine can catch up. */
  status = { pc: false, tube: false };
  mix: Mix = { muted: false, modemVolume: 0.6, musicVolume: 0.6 };
  musicOn = false;
  musicNode: AudioNode | null = null;
  /** The synth's final output (after the limiter), published by the engine for the tape. */
  tapNode: AudioNode | null = null;
  /** A stream of the product's own output for MediaRecorder; never the microphone. Null if the synth is not running. */
  tapStream(): { stream: MediaStream; close: () => void } | null {
    if (!this.ctx || !this.tapNode || typeof this.ctx.createMediaStreamDestination !== "function") return null;
    const dest = this.ctx.createMediaStreamDestination(); this.tapNode.connect(dest);
    return { stream: dest.stream, close: () => { try { this.tapNode?.disconnect(dest); } catch { /* already gone */ } } };
  }

  on<K extends keyof AudioEvents>(name: K, fn: Handler<AudioEvents[K]>) {
    (this.handlers[name] ??= []).push(fn);
    return () => { this.handlers[name] = this.handlers[name].filter((f) => f !== fn); };
  }

  emit<K extends keyof AudioEvents>(name: K, ...payload: AudioEvents[K] extends void ? [] : [AudioEvents[K]]) {
    if (name === "powerOn") this.status.pc = true;
    if (name === "powerOff") this.status.pc = false;
    if (name === "monitorOn") this.status.tube = true;
    if (name === "monitorOff") this.status.tube = false;
    if (name === "music") this.musicOn = !!payload[0];
    if (name === "musicSource") this.musicNode = payload[0] as AudioNode;
    for (const fn of this.handlers[name] ?? []) fn(payload[0]);
  }

  setMix(m: Partial<Mix>) { this.mix = { ...this.mix, ...m }; this.emit("mix"); }

  /** Call from a user gesture (a click on a physical object). Loads the synth on first call. */
  unlock() {
    if (typeof window === "undefined") return;
    try {
      this.ctx ??= new AudioContext({ latencyHint: "interactive" });
      void this.ctx.resume();
    } catch { return; }
    if (!this.loading) {
      this.loading = true;
      const ctx = this.ctx;
      this.ready = import("./engine").then((m) => { m.startSynth(ctx, this); });
    }
  }

  private ready: Promise<void> | null = null;
  /** Resolves once the synth is listening (after the first unlock), so a first click's event is not lost. */
  whenReady() { this.unlock(); return this.ready ?? Promise.resolve(); }
  get context() { return this.ctx; }
}

export const audio = new AudioBus();
