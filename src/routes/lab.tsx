import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Monitor } from "@/components/machine/Monitor";
import type { Engine } from "@/machine/engine";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Lab — Dial-Up terminal bench" },
      { name: "description", content: "Developer bench: stream any art file through the Dial-Up terminal emulator and inspect parser stats." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Lab — Dial-Up terminal bench" },
      { property: "og:description", content: "Stream art through the terminal emulator at modem speed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lab,
});

const HOUSE = ["CRWL-LGO.ANS", "STAIRS.ANS", "SCROLLER.ANS", "SPINNER.ANS", "TERMINAL.ASC", "ICECOLD.ICE", "FILE_ID.DIZ"];

function Lab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [pack, setPack] = useState("crawl-01");
  const [file, setFile] = useState("SCROLLER.ANS");
  const [speed, setSpeed] = useState(9600);
  const [stats, setStats] = useState("power on and press Stream");
  const [powered, setPowered] = useState(false);
  const meta = useRef("");

  useEffect(() => {
    let e: Engine | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    void import("@/machine/engine").then(({ Engine }) => {
      if (!canvas.current) return;
      e = new Engine(canvas.current);
      engine.current = e;
      e.powerOn(); e.setTube(true); setPowered(true);
      timer = setInterval(() => {
        const t = e!.term, m = e!.modem;
        setStats([
          meta.current,
          `bytes fed      ${t.stats.bytes}`,
          `pending        ${m.pending}`,
          `sequences      ${t.stats.sequences}`,
          `unknown seq    ${t.stats.unknown}${t.stats.unknownList.length ? "\n  " + t.stats.unknownList.join("\n  ") : ""}`,
          `rows/cols      ${t.rows} x ${t.cols}${t.ice ? " iCE" : ""} ${t.ninePixel ? "9px" : "8px"}`,
          `scrolled lines ${t.stats.linesScrolled}  (scrollback ${t.scrollbackLines})`,
          `cursor         ${t.x},${t.y}`,
          `fps            ${e!.fps.toFixed(0)}`,
        ].join("\n"));
      }, 250);
    });
    const key = (ev: KeyboardEvent) => {
      const t = engine.current?.term; if (!t || (ev.target as HTMLElement)?.tagName === "INPUT") return;
      if (ev.key === "ArrowUp") t.scrollView(1); else if (ev.key === "ArrowDown") t.scrollView(-1);
      else if (ev.key === "PageUp") t.scrollView(t.rows - 1); else if (ev.key === "PageDown") t.scrollView(-(t.rows - 1));
      else if (ev.key === "Enter") engine.current!.modem.flush(); else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => { clearInterval(timer); window.removeEventListener("keydown", key); e?.destroy(); };
  }, []);

  async function stream() {
    const e = engine.current; if (!e) return;
    const [{ getFile }, { parseSauce }, { prepareArt }] = await Promise.all([import("@/data/archive"), import("@/term/sauce"), import("@/term/prepare")]);
    e.modem.clear();
    try {
      const bytes = await getFile(pack.trim(), file.trim());
      const art = parseSauce(bytes);
      const prep = prepareArt(file, bytes);
      const mode = prep.mode;
      e.term.setMode(mode); e.term.reset();
      e.modem.bps = speed;
      meta.current = `${pack}/${file}\nsize ${bytes.length}, body ${art.body.length}\nsauce ${art.sauce ? `"${art.sauce.title}" by ${art.sauce.author}/${art.sauce.group} w${art.sauce.tInfo1} h${art.sauce.tInfo2} flags ${art.sauce.tFlags}` : "none"}\n`;
      e.modem.write(prep.stream);
    } catch (err) {
      meta.current = `fetch failed: ${(err as Error).message}\n`;
    }
  }

  return (
    <main className="lab">
      <Monitor ref={canvas} powered={powered} onPower={() => { const e = engine.current; if (!e) return; if (e.powered) { e.powerOff(); e.setTube(false); } else { e.powerOn(); e.setTube(true); } setPowered(e.powered); }}
        onBrightness={(v) => { if (engine.current) engine.current.crt.brightness = v; }} />
      <aside className="lab-panel">
        <strong>/lab · terminal bench</strong>
        <label>House pack file
          <select value={pack === "crawl-01" ? file : ""} onChange={(ev) => { setPack("crawl-01"); setFile(ev.target.value); }}>
            <option value="">(archive file below)</option>
            {HOUSE.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label>Pack<input value={pack} onChange={(ev) => setPack(ev.target.value)} placeholder="acdu0193" /></label>
        <label>File<input value={file} onChange={(ev) => setFile(ev.target.value)} placeholder="ACID-RN.ANS" /></label>
        <label>Speed
          <select value={speed} onChange={(ev) => setSpeed(Number(ev.target.value))}>
            {[2400, 9600, 14400, 28800, 115200, 1000000].map((s) => <option key={s} value={s}>{s} bps</option>)}
          </select>
        </label>
        <button type="button" onClick={stream}>Stream</button>
        <button type="button" onClick={() => engine.current?.modem.flush()}>Flush (Enter)</button>
        <div className="lab-stats">{stats}</div>
      </aside>
    </main>
  );
}
