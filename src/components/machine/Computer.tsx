import { useEffect, useRef, useState } from "react";
import { Monitor } from "./Monitor";
import type { Machine } from "@/machine/machine";
import type { DeepLink } from "@/bbs/io";

interface Props { deepLink?: DeepLink & { number: string } }

/** The Kestrel 486: monitor + machine. All canvas/WebGL/audio/storage work starts in effects only. */
export function Computer({ deepLink }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const machine = useRef<Machine | null>(null);
  const [powered, setPowered] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const [{ Engine }, { Machine }] = await Promise.all([import("@/machine/engine"), import("@/machine/machine")]);
      if (disposed || !canvas.current) return;
      const engine = new Engine(canvas.current);
      const m = new Machine(engine);
      machine.current = m;
      const unsub = m.powered.subscribe(setPowered);
      const down = (e: KeyboardEvent) => m.handleKeyDown(e);
      const up = (e: KeyboardEvent) => m.handleKeyUp(e);
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      if (deepLink) m.powerOn(deepLink);
      cleanup = () => { unsub(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); m.powerOff(); engine.destroy(); };
    })();
    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="room">
      <Monitor
        ref={canvas}
        powered={powered}
        onPower={() => machine.current?.togglePower()}
        onBrightness={(v) => { if (machine.current) machine.current.engine.crt.brightness = v; }}
      />
    </main>
  );
}
