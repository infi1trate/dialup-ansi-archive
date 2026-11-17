// Sysop chat: Static breaks in, split screen, scripted. Typed at human speed with the odd typo.
import { a, pad, type Ansi } from "./ansi";
import type { HostIO, KeyHint } from "./io";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Keyword -> replies. First matching rule wins. */
export const RULES: { k: RegExp; say: string[] }[] = [
  { k: /\b(bye|later|cya|gtg|goodnight|night)\b/i, say: ["ok later. dont tie up the line", "night. mom needs the phone at 7 anyway"] },
  { k: /\b(void|secret|hidden|elite|113)\b/i, say: ["theres no secret board. ...who told you", "if u want the quiet board count the stairs. thats all im saying"] },
  { k: /\b(password|nup|pass)\b/i, say: ["never tell anyone ur password. not even me", "the passwords on the credits screen. dont tell anyone i said that"] },
  { k: /\b(who are you|who r u|static|your name)\b/i, say: ["im static. i run this thing from under the stairs", "static. 19. i fix vcrs for money and run a bbs for love"] },
  { k: /\b(art|ansi|ascii|drawing|pack)\b/i, say: ["the 93 packs are the best. fight me", "i drew one ansi once. it was a duck. it was bad", "check the top 10 bulletin, ppl have taste"] },
  { k: /\b(modem|baud|bps|speed|slow|fast|28800|14400|9600|2400)\b/i, say: ["view more files and ur modem negotiates up. 15 files gets u 28.8", "2400 is for monks", "my corvid does 14.4 on a good night and 9600 when it rains"] },
  { k: /\b(door|game|crawl|lord|play)\b/i, say: ["BASEMENT CRAWL! i wrote it in 3 nights. watch out for the pump", "the printer is based on a true story"] },
  { k: /\b(help|how|what do i|stuck|lost)\b/i, say: ["F for files, pick a year, pick a pack, ENTER to watch it draw", "press I on any piece to see who made it", "ENTER skips anything. its on the sticky note man"] },
  { k: /\b(hi|hey|hello|sup|yo)\b/i, say: ["hey whats up", "yo. u woke me up but its cool"] },
  { k: /\b(thanks|thank|thx|cool|nice|awesome|rad)\b/i, say: ["np", "thx for calling. seriously, nobody calls anymore"] },
  { k: /\b(lol|haha|heh)\b/i, say: ["heh", "lol"] },
  { k: /\?$/, say: ["good question. no idea", "ask me after i finish this soda"] },
];
const FILLER = ["mm hm", "yeah", "totally", "the 486 is making a weird noise again", "hang on my mom is yelling", "ok"];
const OPEN = ["hey, static here. u paged?", "*yawn* who's paging at this hour", "ok ok im here. whats up"];

export function reply(line: string): string {
  for (const r of RULES) if (r.k.test(line)) return pick(r.say);
  return pick(FILLER);
}
export const isBye = (line: string) => RULES[0].k.test(line);

const PANE_W = 78;
/** Split into words and single spaces; words longer than the pane are hard-split. */
export function wrapWords(t: string, w = PANE_W): string[] {
  const out: string[] = [];
  for (const tok of t.split(/( )/)) { if (!tok) continue; for (let i = 0; i < tok.length; i += w) out.push(tok.slice(i, i + w)); }
  return out;
}
/** Lay out a reply into pane lines (what sysType draws). */
export function layoutReply(t: string, w = PANE_W): string[] {
  const lines = [""];
  for (const tok of wrapWords(t, w)) {
    const cur = lines[lines.length - 1];
    if (cur.length && cur.length + tok.length > w) { lines.push(tok === " " ? "" : tok); continue; }
    if (!cur.length && tok === " ") continue;
    lines[lines.length - 1] = cur + tok;
  }
  return lines;
}
interface Pane { top: number; rows: number; row: number; col: number; fg: number }

export async function sysopChat(io: HostIO, send: (x: Ansi) => void, hint: (k: KeyHint[]) => void, user: string, hintVoid: boolean) {
  const sys: Pane = { top: 2, rows: 10, row: 0, col: 0, fg: 11 };
  const me: Pane = { top: 14, rows: 9, row: 0, col: 0, fg: 15 };
  const s = a().cls();
  s.at(1, 1).c(15, 4).t(pad(" STATIC (sysop)", 79)).reset();
  s.at(13, 1).c(0, 7).t(pad(` ${user} · ESC ends chat`, 79)).reset();
  s.at(24, 1).k(8, "chat mode · type a line and press ENTER");
  send(s);
  const nl = (p: Pane) => {
    p.row++; p.col = 0;
    if (p.row >= p.rows) { // pane full: wipe it and start at the top, the way cheap chat doors did
      const x = a(); for (let r = 0; r < p.rows; r++) x.at(p.top + r, 1).eol(); send(x); p.row = 0;
    }
  };
  const put = (p: Pane, ch: string) => { send(a().at(p.top + p.row, 1 + p.col).k(p.fg, ch)); p.col++; if (p.col >= PANE_W) nl(p); };
  let ended = false;
  const sysType = async (t: string) => {
    const words = wrapWords(t, PANE_W);
    for (let wi = 0; wi < words.length; wi++) {
     const w = words[wi];
     if (sys.col > 0 && sys.col + w.length > PANE_W) nl(sys); // word would cross the pane edge
     if (sys.col === 0 && w === " ") continue;
     for (const ch of w) {
      if (/[a-z]/.test(ch) && Math.random() < 0.04) { // typo, notice, fix
        put(sys, String.fromCharCode(97 + Math.floor(Math.random() * 26)));
        await sleep(160); send(a().at(sys.top + sys.row, sys.col).raw(" ")); sys.col--; await sleep(120);
      }
      put(sys, ch);
      await io.drain();
      await sleep(ch === " " ? 120 : 45 + Math.random() * 110);
      if (pendingEsc) return;
     }
    }
    nl(sys);
  };
  let pendingEsc = false;
  hint([{ label: "type", key: "", text: true }, { label: "ENTER", key: "Enter" }, { label: "ESC end", key: "Escape" }]);
  await sleep(500);
  await sysType(pick(OPEN));
  let lines = 0, hinted = false;
  while (!ended) {
    let line = "";
    for (;;) {
      const k = await io.keyTimeout(30000);
      if (!k) { await sysType("u still there?"); continue; }
      if (k.key === "Escape") { ended = true; break; }
      if (k.key === "Enter") { nl(me); break; }
      if (k.key === "Backspace") { if (line) { line = line.slice(0, -1); me.col--; send(a().at(me.top + me.row, 1 + me.col).raw(" ")); } continue; }
      if (k.ch !== null && k.ch >= 32 && line.length < 150) { line += String.fromCharCode(k.ch); put(me, String.fromCharCode(k.ch)); }
    }
    if (ended) break;
    if (!line.trim()) continue;
    lines++;
    await sleep(600 + Math.random() * 900);
    let r = reply(line);
    if (!hinted && hintVoid && (lines >= 3 || /void|secret|hidden|elite|stair/i.test(line))) { r = "psst. theres a quieter board. 555-01?3. the stairs know the middle digit"; hinted = true; }
    await sysType(r);
    if (isBye(line) || lines >= 9) { await sysType(lines >= 9 ? "ok i gotta go, the 486 needs me. later!" : "*click*"); ended = true; }
  }
  send(a().at(24, 1).eol().k(12, "chat ended. ").k(8, "back to the board."));
  await io.drain(); await sleep(900);
}
