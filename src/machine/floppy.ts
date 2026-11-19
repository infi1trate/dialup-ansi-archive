// Drive A: and the four floppies on the desk. Pure content + rules; persistence is one localStorage key.
import { a, pad, rpad } from "@/bbs/ansi";
import { encode } from "@/term/cp437";

import { DISK_IDS, type DiskId } from "./floppy-state";
export { DISK_IDS, DISK_LABELS, loadFloppy, saveFloppy, type DiskId } from "./floppy-state";
export const VOLUME: Record<DiskId, string> = { 1: "GAMES2", 2: "PRIVATE", 3: "WICK ART", 4: "DAVE" };
/** The room's owner signs his drawings as "wick". */
export const OWNER = "wick";

export interface FloppyFile { name: string; size: number; date: string; bytes: Uint8Array; kind: "text" | "ansi" | "exe" | "com" }

const text = (lines: string[]) => new Uint8Array(encode(lines.join("\r\n") + "\r\n"));

const READ_ME = [
  "BRICKS v1.1  --  a wall, a ball, a paddle.",
  "",
  "LEFT / RIGHT move the paddle. ESC quits. You get three balls.",
  "Top rows are worth more. Clear the wall and a new one drops in.",
  "",
  "Wrote it in study hall instead of the Civil War unit.",
  "High score: 4,310 (Dave says 6,000. Dave lies.)",
  "",
  "Type BRICKS at the A:\\> prompt.",
];
const DIARY = [
  "DIARY.TXT  --  PRIVATE. THIS MEANS YOU, DAVE.",
  "",
  "03-14-92  Got the modem working. Mom thinks the screaming noise is the",
  "          dryer. Called DEAD CARRIER at 2400. Static typed \"no lamers\"",
  "          and I typed \"ok\" and he let me in anyway. I think.",
  "",
  "05-02-92  FULL BLOCK has a group section so neat it makes my room look",
  "          worse. Downloaded six logos. My ratio is now a rumor.",
  "",
  "07-19-92  LINE NOISE is all text files. Read one about the phone company",
  "          until 3am. Did not phreak anything. Did learn to spell phreak.",
  "",
  "09-08-92  Mom found MAPLE RIDGE PC USERS GROUP. Mr. Hutchins approved a",
  "          picture of a lighthouse for me. Very wholesome. Still grounded",
  "          from STROBE for a week because of the phone bill.",
  "",
  "11-27-92  Back on STROBE. Left a oneliner. A reply came in that only",
  "          said: the sysop's stairwell is the password. Asked Dave what",
  "          it means. Dave says Dave knows. Dave does not know.",
];
const FORMAT_JOKE = [
  "FORMAT.COM  (c) 1992 wick",
  "",
  "Format drive A:? The label says do NOT format. In pen. Underlined.",
  "Request refused for your own safety. Have a nice day.",
];

/** A kid's full-block drawing: one letter per cell (palette index), '.' blank; plus text overlays. */
function blocks(rows: string[], overlays: [number, number, number, string][], title: string) {
  const pal = "kbgcrywKBGCRMYW";
  const idx = (ch: string) => ({ k: 0, b: 1, g: 2, c: 3, r: 4, m: 5, y: 6, w: 7, K: 8, B: 9, G: 10, C: 11, R: 12, M: 13, Y: 14, W: 15 } as Record<string, number>)[ch];
  void pal;
  const x = a().cls();
  rows.forEach((row, r) => { x.at(r + 2, 4); for (const ch of row) { if (ch === ".") x.reset().t(" "); else x.k(idx(ch) ?? 7, "█"); } });
  for (const [r, c, col, t] of overlays) x.at(r, c).k(col, t);
  x.at(23, 4).k(8, `${title} / ${OWNER} '93`).reset();
  return x.build();
}
const OWL = blocks([
  "......yyyy......yyyy......",
  ".....yyyyyyyyyyyyyyyyy....",
  "....yyWWWWyyyyyyWWWWyy....",
  "....yWWkkWWyyyyWWkkWWy....",
  "....yWWkkWWyYYyWWkkWWy....",
  "....yyWWWWyyYYyyWWWWyy....",
  ".....yyyyyyyyyyyyyyyyy....",
  "....yyywwwwwwwwwwwwyyy....",
  "...yyywwwwwkwwwwwwwwyyy...",
  "...yywwwwwwkwwwwwwwwwyy...",
  "...yywwwwwwkkkkkwwwwwyy...",
  "...yyywwwwwwwwwwwwwwyyy...",
  "....yyyywwwwwwwwwwyyyy....",
  "......yyyyyyYyyyyyy.......",
  "............Y.............",
  "............Y.............",
  "...........YYY............",
  "...........YYY............",
], [[6, 40, 14, "the owl clock."], [7, 40, 7, "it says 10:10 forever"], [8, 40, 7, "in the picture."], [10, 40, 8, "the real one ticks."]], "OWL.ANS");
const NIGHT = blocks([
  "..........................................WW....",
  ".....W.............................W....WWWWW...",
  "...........W.......W.....................WWWW...",
  "..W...................................W...WW....",
  ".................W..............................",
  ".......g.................g................g.....",
  "......ggg...............ggg..............ggg....",
  ".....ggggg.....rrrrr...ggggg....g.......ggggg...",
  "....ggggggg...rrrrrrr.ggggggg..ggg.....ggggggg..",
  "...ggggggggg.rrrrrrrrrggggggggggggg...ggggggggg.",
  "......y......yyYYyyyy....y...ggggggg.....y......",
  "......y......yyYYyyyy....y......y........y......",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
], [[16, 6, 7, "our house from the road. the yellow one is the basement window."], [17, 6, 8, "(it is not that yellow. artistic license.)"]], "NIGHT.ANS");
const MODEM = blocks([
  "...wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww...",
  "..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..",
  "..wwKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKww..",
  "..wwKRKRKKRKKKKRKKKRKKKKRKKKKKKKKKKKww..",
  "..wwKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKww..",
  "..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..",
  "...wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww...",
  "........................................",
], [[11, 6, 15, "my modem. it screams so i don't have to."], [12, 6, 7, "red lights = something is happening. no lights = go to bed."], [14, 6, 8, "CONNECT 2400"], [15, 6, 8, "NO CARRIER"]], "MODEM.ANS");

export const DISKS: Record<DiskId, FloppyFile[]> = {
  1: [
    { name: "BRICKS.EXE", size: 23552, date: "10-03-92", bytes: new Uint8Array(encode("KESTREL-RUN:BRICKS")), kind: "exe" },
    { name: "READ.ME", size: 0, date: "10-03-92", bytes: text(READ_ME), kind: "text" },
  ],
  2: [
    { name: "DIARY.TXT", size: 0, date: "11-27-92", bytes: text(DIARY), kind: "text" },
    { name: "FORMAT.COM", size: 1337, date: "06-01-92", bytes: text(FORMAT_JOKE), kind: "com" },
  ],
  3: [
    { name: "OWL.ANS", size: 0, date: "01-09-93", bytes: OWL, kind: "ansi" },
    { name: "NIGHT.ANS", size: 0, date: "02-14-93", bytes: NIGHT, kind: "ansi" },
    { name: "MODEM.ANS", size: 0, date: "03-30-93", bytes: MODEM, kind: "ansi" },
  ],
  4: [
    { name: "NUMBER.TXT", size: 0, date: "11-02-93", bytes: text(["555-0113"]), kind: "text" },
    { name: "LOG.TXT", size: 0, date: "11-03-93", bytes: text(["11-03-93 00:14  dialed it. it picked up. nobody typed. i hung up first."]), kind: "text" },
  ],
};
for (const id of DISK_IDS) for (const f of DISKS[id]) if (!f.size) f.size = f.bytes.length;

export const NOT_READY = ["Not ready reading drive A", "Abort, Retry, Fail?"];

/** DIR A: as Kestrel DOS prints it, or null when the drive is empty. */
export function dirA(disk: DiskId | null): string[] | null {
  if (!disk) return null;
  const files = DISKS[disk];
  const used = files.reduce((n, f) => n + f.size, 0);
  return ["", ` Volume in drive A is ${VOLUME[disk]}`, ` Directory of A:\\`, "",
    ...files.map((f) => { const dot = f.name.indexOf("."); return `${pad(f.name.slice(0, dot), 9)}${pad(f.name.slice(dot + 1), 4)}${rpad(String(f.size), 10)}  ${f.date}   9:41p`; }),
    `${rpad(String(files.length), 9)} file(s)   ${rpad((1457664 - used).toLocaleString("en-US"), 12)} bytes free`, ""];
}
/** A file on the inserted disk by name ("A:\\DIARY.TXT", "diary.txt"), or null. */
export function fileA(disk: DiskId | null, name: string): FloppyFile | null {
  if (!disk) return null;
  const n = name.toUpperCase().replace(/^A:/, "").replace(/^\\/, "");
  return DISKS[disk].find((f) => f.name === n || f.name.replace(/\.[^.]+$/, "") === n) ?? null;
}

/** The drive itself: insert, eject, and whether A: reads. */
export class FloppyDrive {
  constructor(public disk: DiskId | null = null) {}
  insert(id: DiskId) { const was = this.disk; this.disk = id; return was === null ? "inserted" : "swapped"; }
  eject() { const was = this.disk; this.disk = null; return was; }
  get ready() { return this.disk !== null; }
}
