// Audio event bus. Producers (machine, room) emit; the lazily loaded synth engine
// (src/audio/engine.ts) subscribes. The bus itself stays tiny so it can ship in the first frame.
export interface AudioEvents {
  powerOn: void; powerOff: void; keyDown: string; keyUp: string; beep: void;
  diskSeek: void; floppySeek: void; offHook: void; dialDigit: string; ring: void; busy: void;
  handshakeStart: number; connect: number; hangup: void; byteFlow: number;
  monitorOn: void; monitorOff: void; lampToggle: boolean; mix: void;
}
type Handler<T> = (payload: T) => void;

export interface Mix { muted: boolean; modemVolume: number }

class AudioBus {
  private handlers: Record<string, Handler<any>[]> = {};
  private ctx: AudioContext | null = null;
  private loading = false;
  /** What is physically running right now, so a late-starting engine can catch up. */
  status = { pc: false, tube: false };
  mix: Mix = { muted: false, modemVolume: 0.6 };

  on<K extends keyof AudioEvents>(name: K, fn: Handler<AudioEvents[K]>) {
    (this.handlers[name] ??= []).push(fn);
    return () => { this.handlers[name] = this.handlers[name].filter((f) => f !== fn); };
  }

  emit<K extends keyof AudioEvents>(name: K, ...payload: AudioEvents[K] extends void ? [] : [AudioEvents[K]]) {
    if (name === "powerOn") this.status.pc = true;
    if (name === "powerOff") this.status.pc = false;
    if (name === "monitorOn") this.status.tube = true;
    if (name === "monitorOff") this.status.tube = false;
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
      void import("./engine").then((m) => m.startSynth(ctx, this));
    }
  }

  get context() { return this.ctx; }
}

export const audio = new AudioBus();
