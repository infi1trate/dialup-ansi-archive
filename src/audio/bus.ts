// Audio event bus. This pass implements only the PC-speaker beep; the full
// sound design subscribes to these events later.
export interface AudioEvents {
  powerOn: void; powerOff: void; keyDown: string; keyUp: string; beep: void;
  diskSeek: void; floppySeek: void; offHook: void; dialDigit: string; ring: void; busy: void;
  handshakeStart: number; connect: number; hangup: void; byteFlow: number;
}
type Handler<T> = (payload: T) => void;

class AudioBus {
  private handlers: Record<string, Handler<any>[]> = {};
  private ctx: AudioContext | null = null;
  private lastBeep = 0;

  on<K extends keyof AudioEvents>(name: K, fn: Handler<AudioEvents[K]>) {
    (this.handlers[name] ??= []).push(fn);
    return () => { this.handlers[name] = this.handlers[name].filter((f) => f !== fn); };
  }

  emit<K extends keyof AudioEvents>(name: K, ...payload: AudioEvents[K] extends void ? [] : [AudioEvents[K]]) {
    for (const fn of this.handlers[name] ?? []) fn(payload[0]);
    if (name === "beep") this.playBeep();
  }

  /** Call from a user gesture (the power switch click). */
  unlock() {
    if (typeof window === "undefined") return;
    try {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
    } catch { /* audio unavailable */ }
  }

  get context() { return this.ctx; }

  private playBeep() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (now - this.lastBeep < 0.12) return;
    this.lastBeep = now;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.setValueAtTime(0.06, now + 0.14);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}

export const audio = new AudioBus();
