// Tracker playback (libopenmpt via the chiptune3 AudioWorklet, served from /wasm/chiptune3/).
// Lazily imported on the first play. The worklet's output goes to the desk speakers bus.
import { audio } from "./bus";

export interface TrackMeta { title: string; type: string; channels: number; orders: number; patterns: { rows: number[][][] }[]; orderList: number[]; dur: number }
export interface TrackPos { order: number; pattern: number; row: number; pos: number; vu: number[] }

let node: AudioWorkletNode | null = null;
let ready: Promise<AudioWorkletNode> | null = null;
let onPos: ((p: TrackPos) => void) | null = null;
let onMeta: ((m: TrackMeta) => void) | null = null;
let onEnd: (() => void) | null = null;
let onErr: ((e: string) => void) | null = null;

function init(): Promise<AudioWorkletNode> {
  if (ready) return ready;
  ready = (async () => {
    audio.unlock();
    const ctx = audio.context;
    if (!ctx || !ctx.audioWorklet) throw new Error("no sound card");
    await ctx.audioWorklet.addModule("/wasm/chiptune3/chiptune3.worklet.js");
    const n = new AudioWorkletNode(ctx, "libopenmpt-processor", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    n.port.postMessage({ cmd: "config", val: { repeatCount: 0, stereoSeparation: 70, interpolationFilter: 0 } });
    n.port.onmessage = (e) => {
      const d = e.data;
      if (d.cmd === "pos") onPos?.({ order: d.order, pattern: d.pattern, row: d.row, pos: d.pos, vu: d.vu ?? [] });
      else if (d.cmd === "meta") {
        const m = d.meta || {};
        onMeta?.({ title: m.title || "", type: m.type_long || m.type || "", channels: m.song?.channels?.length ?? 0, orders: m.totalOrders ?? 0,
          patterns: m.song?.patterns ?? [], orderList: (m.song?.orders ?? []).map((o: any) => o.pat), dur: m.dur ?? 0 });
      } else if (d.cmd === "end") onEnd?.();
      else if (d.cmd === "err") onErr?.(String(d.val));
    };
    audio.emit("musicSource", n);
    node = n;
    return n;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

export async function play(bytes: Uint8Array, h: { pos(p: TrackPos): void; meta(m: TrackMeta): void; end(): void; error(e: string): void }) {
  const n = await init();
  onPos = h.pos; onMeta = h.meta; onEnd = h.end; onErr = h.error;
  const buf = bytes.slice().buffer;
  n.port.postMessage({ cmd: "play", val: buf }, [buf]);
  audio.emit("music", true);
}
export function setPaused(p: boolean) { node?.port.postMessage({ cmd: p ? "pause" : "unpause" }); audio.emit("music", !p); }
export function stop() { node?.port.postMessage({ cmd: "stop" }); onPos = onMeta = onEnd = null; onErr = null; audio.emit("music", false); }
