// Six original 80x25 postcard designs. Pure bytes: drawn by the board's composer and by /p/<id> playback.
import { a, box, bigText, chromeText, shadeBar, stairwell, center, pad, type Ansi } from "./ansi";
import type { Design, Postcard } from "@/lib/postcard";
import { DESIGN_NAMES } from "@/lib/postcard";

/** Message frame geometry shared by the composer's cursor and the drawing. */
export const FRAME = { fromRow: 10, row: 11, col: 9, w: 64, textCol: 11, lineRow: (i: number) => 12 + i, sigRow: 17, encRow: 19 };
interface Skin { bg: number; frame: number; text: number; accent: number; dim: number }
export const SKINS: Record<Design, Skin> = {
  crawl: { bg: 0, frame: 4, text: 7, accent: 11, dim: 8 },
  vault: { bg: 0, frame: 3, text: 15, accent: 11, dim: 9 },
  c93: { bg: 0, frame: 2, text: 10, accent: 10, dim: 2 },
  maple: { bg: 1, frame: 15, text: 15, accent: 14, dim: 7 },
  strobe: { bg: 0, frame: 13, text: 15, accent: 14, dim: 5 },
  basement: { bg: 0, frame: 6, text: 7, accent: 14, dim: 8 },
};

function header(x: Ansi, d: Design) {
  if (d === "crawl") {
    x.at(1, 1).k(8, "░".repeat(80));
    bigText(x, 3, 9, "DEAD", [12, 4, 4], 8); bigText(x, 3, 35, "CARRIER", [12, 4, 7], 8);
    x.at(6, 9).k(4, "▀▀▀ ▀ ▀▀").k(8, " ▄ ").k(12, "-- greetings from the hostile end of the line --");
    x.at(8, 1).k(8, "▒".repeat(37)).k(4, " 555-0142 ").k(8, "▒".repeat(33));
  } else if (d === "vault") {
    x.at(1, 1); shadeBar(x, 80, 9); x.at(2, 1); shadeBar(x, 80, 11);
    chromeText(x, 3, 10, "FULL BLOCK", [15, 15, 11, 3, 9, 1], 9);
    x.at(7, 1); for (let i = 0; i < 80; i++) x.k([12, 14, 13, 11][i % 4], "▄");
    x.at(8, 1).c(11).t(center("a postcard from the showroom", 80));
  } else if (d === "c93") {
    x.at(1, 1).k(2, "From: LINE NOISE mail relay (555-0193)").at(2, 1).k(2, "To: you").at(3, 1).k(2, "Subject: postcard").at(4, 1).k(2, "X-Line-Quality: hiss").at(6, 1).k(10, "-- begin message --");
  } else if (d === "maple") {
    x.c(15, 1).raw("\x1b[2J");
    box(x, 2, 12, 56, 5, 15, undefined, true, 1);
    x.at(3, 13).c(14, 1).t(center("MAPLE RIDGE PC USERS GROUP", 54)).at(4, 13).c(15, 1).t(center("~ A POSTCARD FOR YOU ~", 54)).at(5, 13).c(7, 1).t(center("Meetings: second Tuesday, library basement", 54));
    x.at(8, 1).c(7, 1).t(center("Mr. Hutchins says: please write back.", 80));
  } else if (d === "strobe") {
    const c = [13, 14, 11];
    for (let r = 1; r <= 8; r++) { x.at(r, 1); for (let i = 0; i < 80; i++) x.k(c[Math.floor((i + r * 2) / 4) % 3], "▓"); }
    bigText(x, 3, 22, "STROBE", [15, 15, 15], 0);
    x.at(7, 25).c(0, 5).t(" postcard / 4 channels / no sleep ");
  } else {
    x.at(1, 1).k(8, "▄".repeat(80));
    bigText(x, 2, 4, "BASEMENT", [7, 6, 6], 8);
    x.at(6, 4).k(14, "GREETINGS FROM THE BASEMENT").k(8, "  where the phone line comes in");
    stairwell(x, 1, 55, 11);
  }
}

export function cardDesign(d: Design) {
  const s = SKINS[d], x = a();
  x.c(s.text, s.bg).raw("\x1b[2J");
  header(x, d);
  box(x, FRAME.row, FRAME.col, FRAME.w, 5, s.frame, undefined, true, s.bg);
  x.at(FRAME.sigRow, FRAME.textCol + 30).c(s.dim, s.bg).t("signed: ").c(s.dim, s.bg).t("____________________");
  if (d !== "c93") { x.at(22, 1).c(s.dim, s.bg).t(center(`${DESIGN_NAMES[d]} postcard  ·  delivered at 2400 baud`, 80)); }
  return x;
}

export function cardBody(c: Postcard, x = a()) {
  const s = SKINS[c.design];
  x.at(FRAME.fromRow, FRAME.textCol).c(s.accent, s.bg).t(pad(`POSTCARD FROM ${c.signature.toUpperCase()}`, 60));
  c.lines.forEach((l, i) => x.at(FRAME.lineRow(i), FRAME.textCol).c(s.text, s.bg).t(pad(l, 60)));
  x.at(FRAME.sigRow, FRAME.textCol + 30).c(s.dim, s.bg).t("signed: ").c(s.accent, s.bg).t(pad(c.signature, 20));
  if (c.enclosed) x.at(FRAME.encRow, FRAME.textCol).c(s.accent, s.bg).t("ENCLOSED: ").c(s.text, s.bg).t(pad(`${c.enclosed.file.toUpperCase()} by ${c.enclosed.artist}`, 50));
  return x;
}

export const cardScreen = (c: Postcard) => cardBody(c, cardDesign(c.design));

/** The three choices on row 24, in the card's own colours. */
export function cardChoices(d: Design) {
  const s = SKINS[d], x = a().at(24, 1).c(s.text, s.bg).raw("\x1b[K");
  x.at(24, 8).c(s.accent, s.bg).t("[R]").c(s.text, s.bg).t(" Reply with a postcard   ").c(s.accent, s.bg).t("[E]").c(s.text, s.bg).t(" Enter the board   ").c(s.accent, s.bg).t("[H]").c(s.text, s.bg).t(" Hang up");
  return x;
}
