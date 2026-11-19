// BASEMENT CRAWL: an original door game. Pure bytes out, keys in, like everything on the board.
import {scoreScreen} from "./score-screen";
import { a, box, center, pad, rpad, type Ansi } from "./ansi";
import type { HostIO, KeyHint } from "./io";
import { net } from "@/data/net";

export interface DoorCtx { io: HostIO; send(x: Ansi): void; user: string; guest: boolean; hint(k: KeyHint[]): void }

const W = 78, H = 17, TOP = 3; // map rows 3..19, cols 2..79
type Mon = { kind: "bunny" | "printer" | "pump"; x: number; y: number; hp: number; tick: number };
type Item = { kind: "disk" | "battery" | "tape"; x: number; y: number };
const MON = {
  bunny: { ch: "*", fg: 7, hp: 2, atk: 1, name: "a dust bunny", pts: 10 },
  printer: { ch: "¶", fg: 15, hp: 5, atk: 2, name: "the rogue dot-matrix printer", pts: 40 },
  pump: { ch: "Ö", fg: 9, hp: 9, atk: 3, name: "the sump pump", pts: 90 },
} as const;
const ITEM = { disk: { ch: "■", fg: 14 }, battery: { ch: "♥", fg: 12 }, tape: { ch: "○", fg: 7 } } as const;
const r = (n: number) => Math.floor(Math.random() * n);
const ARROWS: KeyHint[] = [{ label: "←", key: "ArrowLeft" }, { label: "↑", key: "ArrowUp" }, { label: "↓", key: "ArrowDown" }, { label: "→", key: "ArrowRight" }, { label: "WAIT", key: " ", ch: " " }, { label: "Q quit", key: "q", ch: "q" }];

/** Rooms joined by L-shaped corridors. true = floor. */
export function genFloor(depth: number) {
  const g: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  for (let t = 0; t < 200 && rooms.length < 7; t++) {
    const w = 6 + r(12), h = 3 + r(4), x = 1 + r(W - w - 2), y = 1 + r(H - h - 2);
    if (rooms.some((o) => x < o.x + o.w + 2 && o.x < x + w + 2 && y < o.y + o.h + 1 && o.y < y + h + 1)) continue;
    rooms.push({ x, y, w, h });
  }
  rooms.sort((p, q) => p.x - q.x);
  for (const m of rooms) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) g[y][x] = true;
  const mid = (m: (typeof rooms)[0]) => [m.x + (m.w >> 1), m.y + (m.h >> 1)];
  for (let i = 1; i < rooms.length; i++) {
    const [x1, y1] = mid(rooms[i - 1]), [x2, y2] = mid(rooms[i]);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) g[y1][x] = true;
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) g[y][x2] = true;
  }
  const free = () => { for (;;) { const x = r(W), y = r(H); if (g[y][x]) return { x, y }; } };
  const start = mid(rooms[0]), end = mid(rooms[rooms.length - 1]);
  const mons: Mon[] = [], items: Item[] = [];
  const taken = (x: number, y: number) => (x === start[0] && y === start[1]) || (x === end[0] && y === end[1]) || mons.some((m) => m.x === x && m.y === y) || items.some((i) => i.x === x && i.y === y);
  const place = () => { for (;;) { const p = free(); if (!taken(p.x, p.y) && Math.abs(p.x - start[0]) + Math.abs(p.y - start[1]) > 6) return p; } };
  for (let i = 0; i < 3 + depth; i++) { const p = place(); mons.push({ kind: "bunny", ...p, hp: MON.bunny.hp, tick: 0 }); }
  for (let i = 0; i < Math.floor(depth / 2) + (depth > 1 ? 1 : 0); i++) { const p = place(); mons.push({ kind: "printer", ...p, hp: MON.printer.hp, tick: 0 }); }
  if (depth >= 3) for (let i = 0; i < depth - 2; i++) { const p = place(); mons.push({ kind: "pump", ...p, hp: MON.pump.hp + depth, tick: 0 }); }
  for (let i = 0; i < 3 + r(3); i++) items.push({ kind: "disk", ...place() });
  items.push({ kind: "battery", ...place() });
  if (r(2)) items.push({ kind: "tape", ...place() });
  return { g, start: { x: start[0], y: start[1] }, stairs: { x: end[0], y: end[1] }, mons, items, rooms: rooms.length };
}

/** Score: 100 per disk, 250 per floor cleared, plus monster points. */
export const scoreOf = (disks: number, floors: number, monPts: number) => disks * 100 + floors * 250 + monPts;

export async function doorMenu(c: DoorCtx) {
  for (;;) {
    const x = a().cls();
    box(x, 2, 10, 60, 19, 6, "DOORS");
    x.at(4, 14).k(14, "The sysop finally found the shoebox of floppies.");
    x.at(5, 14).k(8, "One of them still works.");
    x.at(8, 16).hot("1", "  BASEMENT CRAWL", 15, 6, 11).k(8, "  a dungeon below the basement");
    x.at(10, 16).hot("H", "  high scores", 15, 6, 11);
    x.at(12, 16).hot("Q", "  back to the main menu", 15, 6, 11);
    x.at(16, 14).k(7, "10 floor attempts/day; resets at 00:00 UTC.");
    x.at(17, 14).k(8, "Guests can play; only handles go on the score board.");
    x.at(22, 4).k(3, "Door: ").k(11, "1").k(3, ", ").k(11, "H").k(3, " or ").k(11, "Q").k(3, ": ");
    c.send(x);
    c.hint([{ label: "1 PLAY", key: "1", ch: "1" }, { label: "H scores", key: "h", ch: "h" }, { label: "Q back", key: "q", ch: "q" }]);
    const k = await c.io.key();
    const ch = k.ch !== null ? String.fromCharCode(k.ch).toUpperCase() : "";
    c.io.clearOutput();
    if (ch === "1" || k.key === "Enter") await play(c);
    else if (ch === "H") await highScores(c);
    else if (ch === "Q" || k.key === "Escape") return;
  }
}

async function highScores(c: DoorCtx) {
  const res = await net("doorTop");
  c.send(scoreScreen("BASEMENT CRAWL / HALL OF DAMP",res));
  c.hint([{ label: "CONTINUE", key: "Enter" }]);
  await c.io.key();
}

async function play(c: DoorCtx) {
  const io = c.io;
  // intro
  const x = a().cls();
  x.at(2, 1).k(6, center("▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄", 79));
  x.at(3, 1).k(14, center("B A S E M E N T   C R A W L", 79));
  x.at(4, 1).k(6, center("▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀", 79));
  x.at(6, 8).k(7, "Static dropped a box of floppies down the stairs and it kept going.");
  x.at(7, 8).k(7, "Five floors of basement. Bring them back up.");
  x.at(9, 10).k(14, "■").k(7, " floppy disk  100 pts       ").k(12, "♥").k(7, " battery   restores your flashlight");
  x.at(10, 10).k(7, "○").k(7, " duct tape    +1 hit         ").k(15, "▼").k(7, " stairs    down a floor (+250)");
  x.at(12, 10).k(7, "*").k(7, " dust bunny   ").k(15, "¶").k(7, " rogue dot-matrix printer   ").k(9, "Ö").k(7, " the sump pump");
  x.at(14, 10).k(7, "Arrows move. Walk into a monster to hit it. SPACE waits. Q gives up.");
  const turns = await net("doorTurn", { take: false });
  x.at(17, 10).k(11, turns ? `You have ${turns.left} floor attempt${turns.left === 1 ? "" : "s"} left; resets at 00:00 UTC.` : "the message base is offline: today's turns aren't counted.");
  if (c.guest) x.at(18, 10).k(8, "Playing as GUEST: your score won't be posted.");
  x.at(21, 10).k(15, "ENTER").k(7, " descend   ").k(15, "ESC").k(7, " back");
  c.send(x);
  c.hint([{ label: "ENTER descend", key: "Enter" }, { label: "ESC", key: "Escape" }]);
  for (;;) { const k = await io.key(); if (k.key === "Escape") return; if (k.key === "Enter" || k.key === " ") break; }
  if (turns && turns.left <= 0) { await notice(c, "Out of turns for today. The basement will be here tomorrow."); return; }

  const P = { hp: 12, max: 12, atk: 2, disks: 0, floors: 0, pts: 0 };
  let depth = 1, dead = false, quit = false, msg = "";
  while (depth <= 5 && !dead && !quit) {
    if (turns) {
      const t = await net("doorTurn", { take: true });
      if (t && !t.ok) { await notice(c, "That was your last turn for today. The stairs creak shut."); break; }
    }
    const F = genFloor(depth);
    let px = F.start.x, py = F.start.y;
    const cell = (cx: number, cy: number, y: Ansi) => {
      y.at(TOP + cy, 2 + cx);
      if (cx === px && cy === py) return y.k(15, "☺");
      const m = F.mons.find((m) => m.x === cx && m.y === cy);
      if (m) return y.k(MON[m.kind].fg, MON[m.kind].ch);
      const it = F.items.find((i) => i.x === cx && i.y === cy);
      if (it) return y.k(ITEM[it.kind].fg, ITEM[it.kind].ch);
      if (cx === F.stairs.x && cy === F.stairs.y) return y.k(15, "▼");
      if (F.g[cy][cx]) return y.k(8, "·");
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => F.g[cy + dy]?.[cx + dx]);
      return y.k(6, near ? "▓" : " ");
    };
    const status = (y: Ansi) => {
      y.at(21, 2).eol().k(14, msg.slice(0, 77)); msg = "";
      y.at(23, 1).c(0, 6).t(pad(` BASEMENT CRAWL · B${depth} · HP ${P.hp}/${P.max} · hit ${P.atk} · disks ${P.disks} · score ${scoreOf(P.disks, P.floors, P.pts)}`, 79)).reset();
      return y;
    };
    // whole floor once
    const s = a().cls();
    s.at(1, 2).k(6, "▒░ ").k(14, `BASEMENT CRAWL · sub-basement ${depth} of 5`).k(6, " ░▒");
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) if (F.g[cy][cx] || [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => F.g[cy + dy]?.[cx + dx])) cell(cx, cy, s);
    msg = depth === 1 ? "Damp. Smells like old carpet and ozone." : depth === 5 ? "The bottom. You can hear the pump breathing." : `Floor ${depth}. Colder down here.`;
    c.send(status(s));
    c.hint(ARROWS);
    for (;;) {
      const k = await io.key();
      const ch = k.ch !== null ? String.fromCharCode(k.ch).toLowerCase() : "";
      if (ch === "q" || k.key === "Escape") { quit = true; break; }
      const d = k.key === "ArrowLeft" ? [-1, 0] : k.key === "ArrowRight" ? [1, 0] : k.key === "ArrowUp" ? [0, -1] : k.key === "ArrowDown" ? [0, 1] : ch === " " || k.key === " " ? [0, 0] : null;
      if (!d) continue;
      const out = a();
      const ox = px, oy = py, nx = px + d[0], ny = py + d[1];
      const foe = F.mons.find((m) => m.x === nx && m.y === ny);
      if (foe && (d[0] || d[1])) {
        const hit = P.atk + r(3);
        foe.hp -= hit;
        if (foe.hp <= 0) {
          F.mons.splice(F.mons.indexOf(foe), 1); P.pts += MON[foe.kind].pts;
          msg = foe.kind === "printer" ? "The printer jams for the last time. Paper everywhere." : foe.kind === "pump" ? "The sump pump gurgles and goes quiet. Victory, mostly damp." : "The dust bunny disperses. Achoo.";
          cell(nx, ny, out);
        } else msg = `You whack ${MON[foe.kind].name}.`;
      } else if (F.g[ny]?.[nx]) { px = nx; py = ny; }
      // pick up
      const it = F.items.find((i) => i.x === px && i.y === py);
      if (it) {
        F.items.splice(F.items.indexOf(it), 1);
        if (it.kind === "disk") { P.disks++; msg = `A floppy! Label says "${["SCENE.ZIP", "DO NOT ERASE", "MIXTAPE 3", "ACID 93", "TAXES??", "COLORS"][r(6)]}".`; }
        if (it.kind === "battery") { P.hp = P.max; msg = "Fresh batteries. The flashlight is bright again."; }
        if (it.kind === "tape") { P.atk++; msg = "Duct tape on the broom handle. You hit harder."; }
      }
      // monsters act
      for (const m of F.mons) {
        m.tick++;
        if (m.kind === "printer" && m.tick % 2) continue; // slow, but it hurts
        const dist = Math.abs(m.x - px) + Math.abs(m.y - py);
        if (dist === 1) {
          const dmg = MON[m.kind].atk + (depth > 3 ? 1 : 0) - (r(4) === 0 ? 1 : 0);
          P.hp -= Math.max(0, dmg);
          msg = m.kind === "printer" ? "KRRRT-KRRRT! The printer feeds your sleeve." : m.kind === "pump" ? "The sump pump sprays you with something cold." : "A dust bunny gets up your nose.";
          continue;
        }
        let dx = 0, dy = 0;
        if (dist < 9 && (m.kind !== "bunny" || r(3))) { if (Math.abs(px - m.x) > Math.abs(py - m.y)) dx = Math.sign(px - m.x); else dy = Math.sign(py - m.y); }
        else [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]][r(5)];
        const tx = m.x + dx, ty = m.y + dy;
        if (F.g[ty]?.[tx] && !(tx === px && ty === py) && !F.mons.some((o) => o !== m && o.x === tx && o.y === ty)) {
          const fx = m.x, fy = m.y; m.x = tx; m.y = ty; cell(fx, fy, out); cell(tx, ty, out);
        }
      }
      cell(ox, oy, out); cell(px, py, out);
      if (P.hp <= 0) { dead = true; c.send(status(out)); break; }
      if (px === F.stairs.x && py === F.stairs.y) { P.floors++; c.send(status(out)); break; }
      c.send(status(out));
    }
    depth++;
  }
  const score = scoreOf(P.disks, P.floors, P.pts);
  const e = a().cls();
  const won = P.floors >= 5;
  box(e, 5, 14, 52, 13, won ? 14 : dead ? 12 : 6, won ? "YOU MADE IT BACK UP" : dead ? "LIGHTS OUT" : "YOU CLIMB BACK UP");
  e.at(7, 18).k(15, won ? "Five floors down and back. Static owes you a soda." : dead ? "Your flashlight dies. Someone finds you at breakfast." : "Enough basement for one night.");
  e.at(9, 18).k(7, `Floors cleared  ${P.floors}`).at(10, 18).k(7, `Disks found     ${P.disks}`).at(11, 18).k(7, `Monster points  ${P.pts}`);
  e.at(13, 18).k(14, `SCORE           ${score}`);
  let posted = "";
  if (c.guest) posted = "Guest score, not posted. Apply for a handle with NEW.";
  else { const r2 = await net("doorScore", { score, floor: P.floors }); posted = r2?.ok ? "Posted to the Hall of Damp." : r2 ? "The score board said no." : "Message base offline: score not posted."; }
  e.at(15, 18).k(11, posted);
  e.at(22, 4).k(8, "press any key");
  c.send(e);
  c.hint([{ label: "CONTINUE", key: "Enter" }]);
  await io.drain();
  await io.key();
}

async function notice(c: DoorCtx, t: string) {
  const x = a(); box(x, 10, 12, 56, 5, 12, "BASEMENT CRAWL"); x.at(12, 15).k(15, t.slice(0, 50));
  c.send(x); c.hint([{ label: "CONTINUE", key: "Enter" }]);
  await c.io.key();
}
