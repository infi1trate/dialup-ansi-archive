import { blinkPhase, CURSOR_BLINK_HZ, TEXT_BLINK_HZ } from "@/term/blink";
// Display engine: terminal + renderer + modem + CRT, driven by one animation loop.
import { Terminal } from "@/term/terminal";
import { TermRenderer } from "@/term/renderer";
import { Modem } from "@/modem/modem";
import { CRTDisplay, type PowerState } from "@/crt/crt";
import { audio } from "@/audio/bus";
import { screenAverageColor } from "./signals";

export class Engine {
  term = new Terminal();
  renderer = new TermRenderer();
  modem: Modem;
  crt: CRTDisplay;
  power: PowerState = { onT: -1, offT: 99 };
  powered = false;
  private raf = 0;
  private last = 0;
  private avgT = 0;
  private flowT = 0;
  fps = 60;
  /** Called every frame (for lab stats etc.). */
  onFrame: ((dt: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.crt = new CRTDisplay(canvas, reduce);
    this.modem = new Modem((b) => this.term.feed(b));
    this.term.onBell = () => audio.emit("beep");
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
      this.frame(dt, now / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Tube power is separate from the PC: a lit tube with the PC off shows black. */
  tube = false;
  /** Turbo: the modem delivers without throttling. */
  turbo = false;

  setTube(on: boolean) {
    if (on === this.tube) return;
    this.tube = on;
    this.power = on ? { onT: 0, offT: -1 } : { onT: -1, offT: 0 };
  }
  powerOn() { this.powered = true; }
  powerOff() { this.powered = false; this.modem.clear(); this.term.overlay = null; this.term.reset(); }

  private frame(dt: number, t: number) {
    if (this.power.onT >= 0) this.power.onT += dt;
    if (this.power.offT >= 0) this.power.offT += dt;
    if (this.turbo && !this.modem.paused) {
      const bps = this.modem.bps;
      this.modem.bps = 4_000_000; this.modem.tick(dt); this.modem.bps = bps;
    } else this.modem.tick(dt);
    this.flowT += dt;
    if (this.flowT > 0.25) { this.flowT = 0; if (this.modem.rate > 0) audio.emit("byteFlow", this.modem.rate); }
    const blinkOn = blinkPhase(t, TEXT_BLINK_HZ, this.crt.reducedMotion);
    const cursorOn = blinkPhase(t, CURSOR_BLINK_HZ, this.crt.reducedMotion);
    const changed = this.renderer.render(this.term, blinkOn, cursorOn);
    this.crt.render(this.renderer.canvas, changed, this.power, t);
    this.avgT += dt;
    if (this.avgT > 0.1) {
      this.avgT = 0;
      const k = this.powered && this.tube ? 1 : 0;
      const [r, g, b] = this.renderer.avg;
      screenAverageColor.set([r * k, g * k, b * k]);
    }
    this.onFrame?.(dt);
  }

  /** Local output (BIOS, DOS, TELEWIRE): straight to the terminal. */
  local(bytes: Uint8Array) { this.term.feed(bytes); }

  destroy() { cancelAnimationFrame(this.raf); }
}
