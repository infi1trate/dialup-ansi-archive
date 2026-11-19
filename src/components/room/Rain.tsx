import { useEffect, useRef } from "react";

/** Rain running down the basement window glass. A small 2D canvas; frozen under reduced motion. */
export function Rain({ still, heavy = false }: { still: boolean; heavy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hard = useRef(heavy); hard.current = heavy;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = (cv.width = 220), H = (cv.height = 170);
    type Drop = { x: number; y: number; r: number; v: number; trail: number };
    const drops: Drop[] = [];
    const add = (y = Math.random() * H) => drops.push({ x: Math.random() * W, y, r: 0.6 + Math.random() * 1.6, v: 0, trail: 0 });
    for (let i = 0; i < 70; i++) add();
    let raf = 0, last = performance.now(), acc = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(200,215,235,0.10)";
      for (let i = 0; i < 260; i++) { const x = (i * 97.3) % W, y = (i * 53.7 + (i % 7) * 11) % H; ctx.fillRect(x, y, 1, 1); } // static beads
      for (const d of drops) {
        if (d.trail > 2) { ctx.strokeStyle = "rgba(190,205,230,0.16)"; ctx.lineWidth = d.r * 0.7; ctx.beginPath(); ctx.moveTo(d.x, d.y - d.trail); ctx.lineTo(d.x, d.y); ctx.stroke(); }
        ctx.fillStyle = "rgba(215,225,245,0.45)"; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
    };
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
      if (acc < 1 / 12) return;
      const t = acc; acc = 0;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (d.v === 0 && Math.random() < (hard.current ? 0.03 : 0.004) * d.r) d.v = (hard.current ? 25 : 8) + Math.random() * 30;
        if (d.v > 0) { d.y += d.v * t * d.r; d.trail = Math.min(40, d.trail + d.v * t); d.x += Math.sin(d.y * 0.15) * 0.15; if (Math.random() < 0.02) d.v = 0; }
        else d.trail = Math.max(0, d.trail - t * 4);
        if (d.y > H + 5) { drops.splice(i, 1); add(-5); }
      }
      if (Math.random() < 0.3) add();
      if (hard.current) for (let i = 0; i < 4; i++) add();
      if (drops.length > (hard.current ? 240 : 110)) drops.shift();
      draw();
    };
    if (!still) { draw(); raf = requestAnimationFrame(step); }
    return () => cancelAnimationFrame(raf);
  }, [still]);
  return <canvas ref={ref} className="rain" aria-hidden />;
}
