import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import wallImg from "@/assets/room/wall.webp";
import deskImg from "@/assets/room/desk.webp";
import floppiesImg from "@/assets/room/floppies.webp";
import pizzaImg from "@/assets/room/pizza.webp";
import printoutImg from "@/assets/room/printout.webp";
import lampImg from "@/assets/room/lamp.webp";
import { CLOCK, JACK, LAMP, MODEM, MONITOR, NOTE2, STAGE_H, STAIRS, WINDOW } from "./layout";
import { PcCase } from "./PcCase";
import { Modem } from "./Modem";
import { Keyboard } from "./Keyboard";
import { Emissive } from "./Emissive";
import { Rain } from "./Rain";
import { useRoomLive } from "./useRoomLive";

export interface RoomProps {
  monitor: ReactNode;
  powered: boolean;
  turbo: boolean;
  lamp: boolean;
  leaned: boolean;
  reduced: boolean;
  modemVolume: number;
  getState: () => string;
  onPcPower: () => void;
  onTurbo: () => void;
  onLamp: () => void;
  onModemVolume: (v: number) => void;
  onLean: (v: boolean) => void;
  children?: ReactNode;
}

const box = (b: { x: number; y: number; w: number; h?: number }) => ({ left: `${b.x}cqw`, top: `${b.y}cqw`, width: `${b.w}cqw`, height: b.h !== undefined ? `${b.h}cqw` : undefined });
const noFocus = (e: React.MouseEvent) => e.preventDefault();

export function Room(p: RoomProps) {
  const root = useRef<HTMLElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  useRoomLive({ root, getState: p.getState, reduced: p.reduced });

  // ── lean in / lean back: scale the camera until the tube fills the viewport ──
  const placeCamera = useCallback(() => {
    const c = cam.current, st = stage.current, r = root.current;
    const tube = st?.querySelector<HTMLElement>(".monitor-tube");
    if (!c || !st || !tube || !r) return;
    // tube rect in untransformed stage coordinates
    const sr = st.getBoundingClientRect(), tr = tube.getBoundingClientRect();
    const sc = sr.width / st.offsetWidth || 1;
    const tx = (tr.left - sr.left) / sc, ty = (tr.top - sr.top) / sc, tw = tr.width / sc, th = tr.height / sc;
    const st2 = r.style;
    st2.setProperty("--tube-x", `${(tx / st.offsetWidth) * 100}cqw`);
    st2.setProperty("--tube-y", `${(ty / st.offsetWidth) * 100}cqw`);
    st2.setProperty("--tube-w", `${(tw / st.offsetWidth) * 100}cqw`);
    st2.setProperty("--tube-h", `${(th / st.offsetWidth) * 100}cqw`);
    if (!p.leaned) { c.style.transform = "translate(0px, 0px) scale(1)"; return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / tw, vh / th) * 0.97;
    const ox = st.offsetLeft, oy = st.offsetTop; // stage offset inside cam
    const cx = ox + tx + tw / 2, cy = oy + ty + th / 2;
    c.style.transform = `translate(${vw / 2 - cx * s}px, ${vh / 2 - cy * s}px) scale(${s})`;
  }, [p.leaned]);
  useLayoutEffect(() => { placeCamera(); }, [placeCamera]);
  useEffect(() => {
    const on = () => placeCamera();
    window.addEventListener("resize", on);
    const t = setTimeout(on, 300); // fonts/images settled
    return () => { window.removeEventListener("resize", on); clearTimeout(t); };
  }, [placeCamera]);

  // ── parallax: back wall, desk + machines, foreground props ──
  useEffect(() => {
    if (p.reduced) { layers.current.forEach((l) => { if (l) l.style.transform = ""; }); return; }
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const move = (e: PointerEvent) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener("pointermove", move);
    const depth = [0.35, 0.7, 1, 0.7, 0.7, 0.7];
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = now / 1000;
      const dx = tx + Math.sin(t * 0.07) * 0.35, dy = ty + Math.sin(t * 0.05 + 1) * 0.25;
      x += (dx - x) * 0.05; y += (dy - y) * 0.05;
      layers.current.forEach((l, i) => { if (l) l.style.transform = `translate3d(${(-x * 8 * depth[i]).toFixed(2)}px, ${(-y * 5 * depth[i]).toFixed(2)}px, 0)`; });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); };
  }, [p.reduced]);

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".monitor-screen, .monitor-glass")) { if (!p.leaned) p.onLean(true); return; }
    if (t.closest("[data-touch], .hatch")) return;
    if (p.leaned) p.onLean(false);
  };
  const L = (i: number) => (el: HTMLDivElement | null) => { layers.current[i] = el; };

  return (
    <main ref={root} className={`room ${p.lamp ? "lamp-on" : ""} ${p.reduced ? "reduce" : ""} ${p.leaned ? "leaned" : ""}`} onClick={onClick}>
      <h1 className="sr-only">Dial-Up: a 486 in a dark basement, ready to call The Crawlspace BBS</h1>
      <div ref={cam} className="cam">
        <div ref={stage} className="stage" style={{ aspectRatio: `100 / ${STAGE_H}` }}>
          {/* back wall */}
          <div ref={L(0)} className="layer layer-back">
            <img src={wallImg} alt="" className="wall" draggable={false} />
            <div className="window" style={box(WINDOW)}><Rain still={p.reduced} /></div>
            <div className="jack" style={box(JACK)} aria-hidden />
            <div className="stairs" style={box(STAIRS)} aria-hidden><i /><i /><i /><i /><i /></div>
          </div>
          {/* desk + machines */}
          <div ref={L(1)} className="layer layer-mid">
            <img src={deskImg} alt="" className="desk" draggable={false} />
            <svg className="cables" style={{ transform: "translateY(2.4cqw)" }} viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-hidden>
              <path d="M792 495 C 860 470, 930 450, 958 400 S 978 385, 982 386" className="cord-coil" />
              <path d="M792 495 C 860 470, 930 450, 958 400 S 978 385, 982 386" className="cord" />
              <path d="M770 520 C 790 560, 760 600, 720 600" className="cable" />
              <path d="M780 515 C 820 540, 830 600, 870 610" className="cable cable-b" />
              <path d="M160 520 C 120 540, 140 590, 90 610" className="cable" />
              <path d="M150 505 C 100 505, 60 520, 70 470 C 75 440, 40 470, 20 480" className="cable cable-b" />
            </svg>
            <img src={pizzaImg} alt="" className="prop" style={box({ x: 86, y: 37.2, w: 19 })} loading="lazy" draggable={false} />
            <img src={lampImg} alt="Desk lamp" data-touch className="prop lamp" style={box(LAMP)} loading="lazy" draggable={false} onMouseDown={noFocus} onClick={p.onLamp} />
            <div className="clock" style={box(CLOCK)} aria-hidden><span className="clock-brand">NITEWATCH</span></div>
            <PcCase powered={p.powered} turbo={p.turbo} onPower={p.onPcPower} onTurbo={p.onTurbo} />
            <div className="monitor-mount" style={{ left: `${MONITOR.x}cqw`, top: `${MONITOR.bottom}cqw`, width: `${MONITOR.w}cqw`, ["--mon-w" as string]: `${MONITOR.w}cqw` }}>{p.monitor}</div>
            <Modem volume={p.modemVolume} onVolume={p.onModemVolume} />
          </div>
          {/* foreground props */}
          <div ref={L(2)} className="layer layer-front">
            <div className="note2" style={box(NOTE2)} aria-label="A second sticky note, half under the keyboard">call 555-0113</div>
            <Keyboard />
            <img src={floppiesImg} alt="" className="prop" style={box({ x: -1.5, y: 48.6, w: 17 })} loading="lazy" draggable={false} />
            <img src={printoutImg} alt="" className="prop printout" style={box({ x: 70, y: 51.2, w: 22 })} loading="lazy" draggable={false} />
            <i className="front-shade" aria-hidden />
          </div>
          {/* light: multiply map (where light falls), then screen-blend tint, then emissive parts */}
          <div ref={L(3)} className="layer lightmap" aria-hidden>
            <i className="lm-ambient" />
            <i className="lm-window" style={box(WINDOW)} />
            <i className="lm-street" />
            <i className="lm-headlight" />
            <i className="lm-spill-wall" />
            <i className="lm-spill-desk" />
            <i className="lm-tube" />
            <i className="lm-lamp" />
            <i className="lm-clock" style={box({ x: CLOCK.x - 2, y: CLOCK.y - 2, w: CLOCK.w + 4, h: CLOCK.h + 4 })} />
            <i className="lm-modem" style={box({ x: MODEM.x - 1, y: MODEM.y - 1, w: MODEM.w + 2, h: MODEM.h + 3 })} />
          </div>
          <div ref={L(4)} className="layer glow" aria-hidden>
            <i className="gl-spill" />
            <i className="gl-lamp" />
          </div>
          <div ref={L(5)} className="layer emissive" aria-hidden>
            <Emissive powered={p.powered} turbo={p.turbo} />
          </div>
        </div>
      </div>
      <div className="grade" aria-hidden><i className="grade-vignette" /><i className="grade-grain" /></div>
      {p.children}
    </main>
  );
}
