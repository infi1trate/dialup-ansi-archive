// "Send a postcard": composer, preview and send, all bytes through the modem in the card's own design.
import { a, pad, center } from "./ansi";
import type { Board } from "./board";
import { net } from "@/data/net";
import { DESIGNS, DESIGN_NAMES, LINE_MAX, SIG_MAX, type Design, type Enclosed, type Postcard } from "@/lib/postcard";
import { cardDesign, cardBody, cardScreen, FRAME, SKINS } from "./postcard-art";

const hint = (c: string, label = c) => ({ label, key: c, ch: c });
const NAVK = [{ label: "←", key: "ArrowLeft" }, { label: "→", key: "ArrowRight" }, { label: "ENTER", key: "Enter" }, { label: "ESC", key: "Escape" }];
const footer = (d: Design, text: string) => { const s = SKINS[d]; return a().at(25, 1).c(s.bg === 1 ? 14 : 0, s.bg === 1 ? 1 : 7).t(pad(" " + text, 79)).build(); };

export function defaultDesign(board: string): Design { return (DESIGNS as readonly string[]).includes(board) ? board as Design : "basement"; }

async function line(b: Board, d: Design, row: number, col: number, max: number, start: string) {
  let s = start; const sk = SKINS[d];
  b.send(a().at(row, col).c(sk.text, sk.bg).t(pad(s, max)).at(row, col + s.length));
  b.hint([{ label: "type", key: "", text: true }, { label: "⌫", key: "Backspace" }, { label: "ENTER", key: "Enter" }, { label: "ESC", key: "Escape" }]);
  for (;;) {
    const k = await b.key();
    if (k.key === "Escape") return null;
    if (k.key === "Enter") return s;
    if (k.key === "Backspace") { if (s.length) { s = s.slice(0, -1); b.send(a().raw("\b \b")); } continue; }
    if (k.ch !== null && k.ch >= 32 && k.ch < 127 && s.length < max) { s += String.fromCharCode(k.ch); b.send(a().c(sk.text, sk.bg).raw(String.fromCharCode(k.ch))); }
  }
}

/** Returns the sent card id, or null when cancelled. */
export async function composePostcard(b: Board, enclosed: Enclosed | null = null, replyTo?: string): Promise<string | null> {
  let i = Math.max(0, DESIGNS.indexOf(defaultDesign(b.ioEntryId())));
  // 1. pick a design
  for (;;) {
    const d = DESIGNS[i];
    b.send(cardDesign(d).at(FRAME.fromRow, FRAME.textCol).c(SKINS[d].accent, SKINS[d].bg).t(`DESIGN ${i + 1} OF 6: ${DESIGN_NAMES[d].toUpperCase()}`));
    b.clientOverlay(footer(d, "←→ choose a design  ·  ENTER write on this one  ·  ESC cancel"));
    b.hint(NAVK);
    const k = await b.key(); b.clearPending();
    if (k.key === "Escape") { b.clientOverlay(null); return null; }
    if (k.key === "ArrowLeft" || k.key === "ArrowUp") i = (i + 5) % 6;
    else if (k.key === "ArrowRight" || k.key === "ArrowDown" || k.key === " ") i = (i + 1) % 6;
    else if (k.ch !== null && k.ch >= 49 && k.ch <= 54) i = k.ch - 49;
    else if (k.key === "Enter") break;
  }
  const design = DESIGNS[i];
  const card: Postcard = { board: b.ioEntryId(), design, lines: ["", "", ""], signature: b.guest ? "GUEST" : b.user, enclosed };
  for (;;) {
    // 2. write: three lines and a signature, typed straight onto the card
    b.send(cardBody(card, cardDesign(design)));
    b.clientOverlay(footer(design, `type up to ${LINE_MAX} characters a line  ·  ENTER next line  ·  ESC cancel`));
    for (let n = 0; n < 3; n++) { const t = await line(b, design, FRAME.lineRow(n), FRAME.textCol, LINE_MAX, card.lines[n]); if (t === null) { b.clientOverlay(null); return null; } card.lines[n] = t; }
    b.clientOverlay(footer(design, `signature, up to ${SIG_MAX} characters  ·  ENTER keeps it`));
    const sig = await line(b, design, FRAME.sigRow, FRAME.textCol + 38, SIG_MAX, card.signature);
    if (sig === null) { b.clientOverlay(null); return null; }
    card.signature = sig.trim() || (b.guest ? "GUEST" : b.user);
    // 3. preview
    for (;;) {
      b.send(cardScreen(card));
      b.clientOverlay(footer(design, "PREVIEW  ·  S send  ·  W rewrite  ·  ESC throw it away"));
      b.hint([hint("S", "S send"), hint("W", "W rewrite"), { label: "ESC", key: "Escape" }]);
      const k = await b.key(); b.clearPending();
      const c = String.fromCharCode(k.ch ?? 0).toUpperCase();
      if (k.key === "Escape") { b.clientOverlay(null); return null; }
      if (c === "W") break;
      if (c !== "S") continue;
      b.clientOverlay(footer(design, "posting..."));
      const r = await net("postcardSend", { card, guest: b.guest, replyTo });
      if (!r || r.error) {
        b.clientOverlay(footer(design, String(r?.error ?? "The mail office is offline. Try again later.").slice(0, 76)));
        await b.ioTimeout(2500);
        continue;
      }
      window.__lovableEvents?.track?.("project.postcard_sent", { board: b.ioEntryId(), reply: !!replyTo });
      return await linkScreen(b, design, String(r.id));
    }
  }
}

async function linkScreen(b: Board, d: Design, id: string) {
  b.clientOverlay(null);
  const url = (typeof location !== "undefined" ? location.origin : "https://dialup-ansi-archive.lovable.app") + "/p/" + id;
  const x = b.header(a(), "Postcard sent", "it waits by the phone for 180 days");
  const bg = b.ioEntryId() === "maple" ? 1 : 0;
  x.at(8, 5).k(15, "Your postcard is in the mail. Give this number to a friend:", bg);
  x.at(11, 1).k(14, center(url, 79), bg);
  x.at(14, 5).k(7, "When they open it, their computer powers on by itself and dials", bg).at(15, 5).k(7, "this board at 2400 baud to deliver your card.", bg);
  x.at(18, 5).k(8, "Nothing about you is in the link. Reported cards are withdrawn.", bg);
  b.send(x);
  b.shareLink(url);
  await b.anyKey(22);
  b.shareLink(null);
  return id;
}
