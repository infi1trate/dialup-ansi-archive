// BRICKS.EXE from the GAMES #2 floppy: an original text-mode wall-and-ball game. Local program (never through the modem).
import { a, box } from "@/bbs/ansi";
import type { LocalEnv } from "./programs";

export const BRICK_COLS = 12, BRICK_ROWS = 5, BRICK_W = 6;
const LEFT = 3, RIGHT = 78, TOP = 3, BOTTOM = 23, PADDLE_ROW = 22, PADDLE_W = 9;
const COLORS = [12, 14, 10, 11, 13];
export interface BricksState { bricks: boolean[]; px: number; bx: number; by: number; dx: number; dy: number; lives: number; score: number; serving: number; over: boolean }
export function newBricks(): BricksState { return { bricks: Array(BRICK_COLS * BRICK_ROWS).fill(true), px: 36, bx: 40, by: PADDLE_ROW - 1, dx: 1, dy: -1, lives: 3, score: 0, serving: 8, over: false }; }
const brickAt = (x: number, y: number) => { const r = y - 5; if (r < 0 || r >= BRICK_ROWS) return -1; const c = Math.floor((x - 4) / BRICK_W); if (c < 0 || c >= BRICK_COLS || (x - 4) % BRICK_W === BRICK_W - 1) return -1; return r * BRICK_COLS + c; };

/** One tick: move the paddle (-1, 0, 1 steps of 3 columns), then the ball. Pure. */
export function bricksStep(s: BricksState, move: -1 | 0 | 1): BricksState {
  if (s.over) return s;
  const n = { ...s, bricks: s.bricks.slice() };
  n.px = Math.max(LEFT + 1, Math.min(RIGHT - PADDLE_W, n.px + move * 3));
  if (n.serving > 0) { n.serving--; n.bx = n.px + 4; n.by = PADDLE_ROW - 1; return n; }
  let nx = n.bx + n.dx, ny = n.by + n.dy;
  if (nx <= LEFT || nx >= RIGHT) { n.dx = -n.dx; nx = n.bx + n.dx; }
  if (ny <= TOP) { n.dy = 1; ny = n.by + n.dy; }
  const hit = brickAt(nx, ny);
  if (hit >= 0 && n.bricks[hit]) { n.bricks[hit] = false; n.score += (BRICK_ROWS - Math.floor(hit / BRICK_COLS)) * 10; n.dy = -n.dy; ny = n.by + n.dy; }
  if (ny === PADDLE_ROW && nx >= n.px && nx < n.px + PADDLE_W) { n.dy = -1; const off = nx - n.px; n.dx = off < 3 ? -1 : off > 5 ? 1 : n.dx; ny = n.by + n.dy; }
  if (ny >= BOTTOM) { n.lives--; if (n.lives <= 0) { n.over = true; return n; } n.serving = 10; n.dy = -1; return n; }
  n.bx = nx; n.by = ny;
  if (n.bricks.every((b) => !b)) { n.bricks = Array(BRICK_COLS * BRICK_ROWS).fill(true); n.serving = 10; }
  return n;
}
function frame(s: BricksState) {
  const x = a().reset().cls();
  box(x, 2, 2, 78, 23, 8, "BRICKS v1.1");
  x.at(2, 50).k(8, "╡").k(14, ` SCORE ${String(s.score).padStart(5, "0")} `).k(8, "╞═╡").k(12, ` ${"♥".repeat(Math.max(0, s.lives))}${" ".repeat(3 - Math.max(0, s.lives))} `).k(8, "╞");
  x.at(24, 28).k(8, "╡").k(7, " LEFT/RIGHT move · ESC quits ").k(8, "╞");
  for (let i = 0; i < s.bricks.length; i++) if (s.bricks[i]) { const r = Math.floor(i / BRICK_COLS), c = i % BRICK_COLS; x.at(5 + r, 4 + c * BRICK_W).k(COLORS[r], "▀".repeat(BRICK_W - 1)); }
  x.at(PADDLE_ROW, s.px).k(15, "▀".repeat(PADDLE_W));
  x.at(s.by, s.bx).k(15, "■");
  return x;
}
export async function bricks(env: LocalEnv) {
  const restore = env.preserveMode?.();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let s = newBricks();
  env.hint?.([{ label: "←", key: "ArrowLeft" }, { label: "→", key: "ArrowRight" }, { label: "ESC", key: "Escape" }]);
  try {
    for (;;) {
      env.out(frame(s));
      if (s.over) { env.out(a().at(13, 30).k(12, " GAME OVER ").at(15, 26).k(7, `score ${s.score}. any key returns.`)); await env.nextOr(new Promise(() => {})); return; }
      const k = await env.nextOr(sleep(70));
      if (k?.key === "Escape") return;
      s = bricksStep(s, k?.key === "ArrowLeft" ? -1 : k?.key === "ArrowRight" ? 1 : 0);
    }
  } finally { env.out(a().reset().cls()); restore?.(); }
}
