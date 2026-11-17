// THE CRAWLSPACE BBS — the virtual host. Writes bytes, reads keys. Nothing else.
import { Ansi, a, bigText, box, center, pad, rpad, shadeBar } from "./ansi";
import type { HostIO, DeepLink } from "./io";
import type { Key } from "@/machine/keyboard";
import { Aborted } from "@/machine/keyboard";
import { maxSpeed } from "@/machine/storage";
import { getFile, getGroupPacks, getGroups, getPack, getYearPacks, getYears, MAX_YEAR, MIN_YEAR } from "@/data/archive";
import { HOUSE_PACK } from "@/data/housepack";
import type { PackFile, PackInfo, PackSummary, Page } from "@/data/types";
import { parseSauce, sauceDate, type Sauce } from "@/term/sauce";
import { ANSI_VGA, type TermMode } from "@/term/terminal";

const SYSOP = "Static";
const QUOTES = [
  "\"The modem is the message.\" — overheard at a 2600 meeting",
  "\"Real artists ship. Real sysops reboot.\" — Static",
  "\"I'll just download one more pack.\" — every caller, 4:12am",
  "\"Your mother called. The line was busy.\" — the Crawlspace",
  "\"Sixteen colors ought to be enough for anybody.\"",
  "\"Upload/download ratio: a state of mind.\"",
];
const CALLERS = [
  ["Phosphor", "Lakewood", "11:52p"], ["Lord Cyan", "Port Ellis", "11:20p"], ["Ms. Halftone", "Grayson", "10:47p"],
  ["Dr. Baud", "Milltown", "10:02p"], ["Nyx", "Somerset", "9:31p"], ["Kilobyte Kid", "Lakewood", "8:58p"], ["Parity Error", "Ashby", "8:15p"],
];
const ONELINERS = [
  ["Phosphor", "anyone got the new acid pack? 9600 is too slow for this"],
  ["Nyx", "static pls install a door game already"],
  ["Lord Cyan", "greetz to everyone on node 2 at 3am"],
  ["Dr. Baud", "my mom picked up the phone mid-download AGAIN"],
  ["Ms. Halftone", "shade blocks are a lifestyle"],
  ["Kilobyte Kid", "first time caller, long time lurker"],
];
const BULLETINS = [
  { title: "Welcome to the Crawlspace", body: [
    "The Crawlspace has been running on a 486 under the stairs since 1991.",
    "We carry the art scene's archive: ANSI, ASCII and iCE packs from",
    "1990 to 1996, sent to you byte by byte at whatever your modem can take.",
    "", "Be cool. Leave a oneliner. Don't tie up the line during dinner." ] },
  { title: "Modem speeds & you", body: [
    "New callers connect at 9600. View 5 files and your modem negotiates",
    "14400. View 15 and you unlock 28800. Masochists may choose 2400.",
    "", "Set your speed in TELEWIRE's modem setup (press S at the directory)." ] },
  { title: "Takedown policy", body: [
    "All art on this board belongs to its artists. If you made something",
    "here and want it gone, write the sysop: sysop@ (placeholder address).", ] },
];

class Board {
  user = "Guest";
  guest = true;
  constructor(private io: HostIO) {}

  // ── output helpers ─────────────────────────────────────────────
  send(x: Ansi | Uint8Array) { this.io.send(x instanceof Ansi ? x.build() : x); }
  async key(): Promise<Key> { return this.io.key(); }

  async anyKey(row?: number) {
    const x = a();
    if (row) x.at(row, 1); else x.nl();
    x.k(8, "  ░▒▓").k(5, "[").k(15, " press any key ").k(5, "]").k(8, "▓▒░");
    this.send(x);
    await this.key();
    this.io.clearOutput();
    this.send(a().raw("\r").eol());
  }

  /** Line input with remote echo through the modem. */
  async input(max: number, opts: { mask?: boolean; fg?: number } = {}): Promise<string> {
    let s = "";
    this.send(a().c(opts.fg ?? 15));
    for (;;) {
      const k = await this.key();
      if (k.key === "Enter") { this.send(a().reset().nl()); return s.trim(); }
      if (k.key === "Backspace") { if (s.length) { s = s.slice(0, -1); this.send(a().raw("\b \b")); } continue; }
      if (k.ch !== null && s.length < max) {
        s += String.fromCharCode(k.ch);
        this.send(a().raw(opts.mask ? "*" : String.fromCharCode(k.ch)));
      }
    }
  }

  header(x: Ansi, title: string, sub?: string) {
    x.cls().at(1, 1);
    shadeBar(x, 79, 1);
    x.at(2, 3).k(11, "THE CRAWLSPACE BBS").k(8, " ── ").k(13, title);
    if (sub) x.at(2, 79 - sub.length).k(3, sub);
    x.at(3, 1).k(8, "─".repeat(79));
    return x;
  }

  status(x: Ansi, row = 24) {
    const left = Math.max(0, Math.ceil(this.io.timeLeftMs() / 60000));
    x.at(row, 1).c(15, 1).t(pad(` ${this.user}`, 26)).c(11, 1).t(pad(`node ${this.io.node}`, 12))
      .c(14, 1).t(pad(`${this.io.speed} bps`, 14)).c(15, 1).t(rpad(`time left: ${left} min `, 27)).reset();
    return x;
  }

  async errorScreen(what: string) {
    const x = a().cls();
    box(x, 7, 14, 52, 10, 12, "CARRIER TROUBLE");
    x.at(9, 17).k(15, "The archive drive didn't answer.");
    x.at(11, 17).k(7, pad(what, 46));
    x.at(13, 17).k(3, "The sysop has been notified (he's asleep).");
    x.at(14, 17).k(3, "The house pack CRAWL-01 is always on line.");
    this.send(x);
    await this.anyKey(18);
  }

  // ── lightbar ───────────────────────────────────────────────────
  async lightbar(o: { row: number; col: number; width: number; height: number; items: { text: string; color: number; dim?: boolean }[]; index?: number; hotkeys?: string }): Promise<{ index: number; key?: string } | null> {
    const { row, col, width, height, items } = o;
    let i = Math.max(0, Math.min(items.length - 1, o.index ?? 0));
    let top = Math.floor(i / height) * height;
    const line = (n: number, sel: boolean) => {
      const x = a().at(row + (n - top), col);
      const it = items[n];
      if (!it) return x.reset().rep(" ", width);
      return sel ? x.c(15, 1).t(pad(" " + it.text, width)) : x.c(it.dim ? 8 : it.color).t(pad(" " + it.text, width));
    };
    const page = () => {
      const x = a();
      for (let r = 0; r < height; r++) x.bytes(line(top + r, top + r === i).build());
      const pages = Math.max(1, Math.ceil(items.length / height));
      x.at(row + height, col).k(8, pad(`page ${Math.floor(top / height) + 1}/${pages}  ·  ${items.length} entries`, width));
      this.send(x);
    };
    if (!items.length) { this.send(a().at(row, col).k(8, "  (nothing here)")); }
    page();
    for (;;) {
      const k = await this.key();
      const prev = i;
      switch (k.key) {
        case "ArrowUp": i = Math.max(0, i - 1); break;
        case "ArrowDown": i = Math.min(items.length - 1, i + 1); break;
        case "PageUp": i = Math.max(0, i - height); break;
        case "PageDown": i = Math.min(items.length - 1, i + height); break;
        case "Home": i = 0; break;
        case "End": i = items.length - 1; break;
        case "Enter": if (items.length) { this.io.clearOutput(); return { index: i }; } break;
        case "Escape": this.io.clearOutput(); return null;
        default:
          if (k.ch !== null && o.hotkeys?.includes(String.fromCharCode(k.ch).toUpperCase())) { this.io.clearOutput(); return { index: i, key: String.fromCharCode(k.ch).toUpperCase() }; }
      }
      if (i === prev || i < 0) continue;
      const ntop = Math.floor(i / height) * height;
      if (ntop !== top) { top = ntop; page(); }
      else this.send(a().bytes(line(prev, false).build()).bytes(line(i, true).build()));
    }
  }

  // ── login ──────────────────────────────────────────────────────
  logo(x: Ansi) {
    x.cls();
    x.at(1, 1); shadeBar(x, 79, 1);
    x.at(3, 34).k(8, "· t h e ·");
    bigText(x, 5, 10, "CRAWLSPACE", [11, 3, 1], 8);
    bigText(x, 9, 31, "BBS", [13, 5, 5], 8);
    x.at(13, 1); shadeBar(x, 79, 5);
    x.at(14, 1).k(7, center("Running on a 486 under the stairs since 1991", 79));
    x.at(15, 1).k(3, center(`sysop: ${SYSOP}  ·  ${this.io.entry.name}  ·  ${this.io.entry.number}`, 79));
    return x;
  }

  async login(): Promise<void> {
    this.send(this.logo(a()).at(17, 1));
    const p = this.io.profile;
    for (let tries = 0; ; tries++) {
      this.send(a().at(17, 1).raw("\x1b[J").at(17, 4).k(7, "Enter your handle, ").k(15, "NEW").k(7, " to apply, or ").k(15, "GUEST").k(7, " to look around.")
        .at(19, 4).k(13, "Handle").k(5, ": "));
      const h = await this.input(20);
      if (!h) continue;
      if (h.toUpperCase() === "GUEST") { this.user = "Guest"; this.guest = true; return; }
      if (h.toUpperCase() === "NEW") { await this.newUser(); return; }
      if (p.handle && h.toLowerCase() === p.handle.toLowerCase()) {
        for (let pt = 0; pt < 3; pt++) {
          this.send(a().at(20, 4).eol().k(13, "Password").k(5, ": "));
          const pw = await this.input(16, { mask: true });
          if (pw === (p.password ?? "")) { this.user = p.handle; this.guest = false; return; }
          this.send(a().at(22, 4).eol().k(12, "Wrong password.").raw("\x07"));
        }
        this.send(a().at(22, 4).eol().k(12, "Too many tries. Static's modem hangs up on you."));
        await this.io.drain();
        throw new Aborted("hangup");
      }
      this.send(a().at(22, 4).eol().k(14, `No caller named "${h}". Type NEW to apply.`));
      if (tries > 6) throw new Aborted("hangup");
    }
  }

  async newUser() {
    const x = this.header(a(), "New caller application");
    box(x, 5, 6, 68, 5, 12, "READ THIS");
    x.at(6, 9).k(15, "Do NOT use a real password here.").at(7, 9).k(7, "This board keeps your account in this browser only, in plain text.")
      .at(8, 9).k(7, "Make something up. Write it on a sticky note like it's 1992.");
    this.send(x);
    let handle = "";
    while (!handle) {
      this.send(a().at(11, 6).eol().k(11, "Handle (no real names)").k(5, ": "));
      handle = await this.input(20);
      if (["NEW", "GUEST", "SYSOP", "STATIC"].includes(handle.toUpperCase())) { this.send(a().at(12, 6).k(12, "That one's taken.")); handle = ""; }
    }
    this.send(a().at(12, 6).eol().k(11, "City").k(5, ": "));
    const city = await this.input(24);
    this.send(a().at(13, 6).k(11, "What's the best sound a modem makes?").k(5, ": "));
    const joke = await this.input(30);
    this.send(a().at(14, 6).k(11, "Password (fake!)").k(5, ": "));
    const pw = await this.input(16, { mask: true });
    Object.assign(this.io.profile, { handle, city, joke, password: pw });
    this.io.save();
    this.user = handle; this.guest = false;
    this.send(a().at(16, 6).k(10, `Welcome aboard, ${handle}. Validation pending (Static is asleep).`));
    if (joke) this.send(a().at(17, 6).k(8, `Noted: "${joke.slice(0, 50)}". Bold choice.`));
    await this.anyKey(19);
  }

  // ── logon parade ───────────────────────────────────────────────
  async lastCallers() {
    const x = this.header(a(), "Last 10 callers", this.io.entry.number);
    x.at(5, 4).k(13, pad("#", 4)).k(13, pad("Handle", 22)).k(13, pad("From", 20)).k(13, pad("Node", 7)).k(13, "Time");
    x.at(6, 4).k(5, "─".repeat(62));
    const list = [[this.user, this.guest ? "somewhere" : this.io.profile.city || "parts unknown", "now"], ...CALLERS];
    list.slice(0, 8).forEach((c, n) => {
      x.at(7 + n, 4).k(8, pad(String(n + 1).padStart(2, "0"), 4)).k(n === 0 ? 15 : 11, pad(c[0], 22)).k(3, pad(c[1], 20)).k(7, pad(String((n % 2) + 1), 7)).k(9, c[2]);
    });
    this.send(x);
    await this.anyKey(17);
  }

  async news() {
    const x = this.header(a(), "News");
    box(x, 5, 4, 72, 12, 9, "11.17.93");
    const lines = [
      [15, "Archive drive is back on line!"], [7, "Static swapped the 120MB for a whole archive's worth of"],
      [7, "art packs, 1990-1996. Browse by year in the [F]ile areas."], [7, ""],
      [11, "Call our sister lines:"], [7, "  Group Vault  555-0167   ·   Class of '93  555-0193"], [7, ""],
      [13, "Door games: coming soon. Very soon. Any day now."],
    ] as const;
    lines.forEach(([c, t], n) => x.at(7 + n, 7).k(c, t));
    this.send(x);
    await this.anyKey(18);
  }

  async oneliners() {
    const x = this.header(a(), "Oneliners wall");
    ONELINERS.forEach(([h, t], n) => {
      x.at(5 + n * 2, 4).k(8, "░▒▓").k(n % 2 ? 13 : 11, pad(h, 14)).k(7, t);
    });
    x.at(18, 4).k(8, "(The wall is read-only until Static finishes the multi-node patch.)");
    this.send(x);
    await this.anyKey(20);
  }

  // ── main menu ──────────────────────────────────────────────────
  menuScreen() {
    const x = a().cls();
    x.at(1, 1); shadeBar(x, 79, 1);
    bigText(x, 3, 10, "CRAWLSPACE", [11, 3, 1], 8);
    x.at(6, 64).k(13, "main menu");
    box(x, 8, 8, 64, 11, 5);
    const left: [string, string][] = [["F", "iles"], ["B", "ulletins"], ["O", "neliners"], ["W", "ho's online"], ["U", "ser list"]];
    const right: [string, string][] = [["P", "age sysop"], ["D", "oors"], ["C", "redits"], ["G", "oodbye"]];
    left.forEach(([k, l], n) => x.at(10 + n * 2, 14).hot(k, l, 15, 13, 11));
    right.forEach(([k, l], n) => x.at(10 + n * 2, 44).hot(k, l, 15, 13, 11));
    x.at(19, 1).k(7, center(this.io.entry.blurb, 79));
    this.status(x, 21);
    x.at(23, 4).k(13, "Main").k(8, " ▸ ").k(11, "Command").k(5, ": ").c(15);
    return x;
  }

  async mainMenu(): Promise<"bye"> {
    for (;;) {
      this.send(this.menuScreen());
      const k = await this.key();
      const c = (k.ch !== null ? String.fromCharCode(k.ch) : "").toUpperCase();
      // a hotkey interrupts the menu still drawing, like any good BBS
      if ("FBOWUPDCG".includes(c) && c) this.io.clearOutput();
      if (c) this.send(a().k(15, c));
      switch (c) {
        case "F": await this.files(); break;
        case "B": await this.bulletins(); break;
        case "O": await this.oneliners(); break;
        case "W": await this.whosOnline(); break;
        case "U": await this.userList(); break;
        case "P": await this.pageSysop(); break;
        case "D": await this.doors(); break;
        case "C": await this.credits(); break;
        case "G": if (await this.confirmBye()) return "bye"; break;
      }
    }
  }

  async bulletins() {
    for (;;) {
      const x = this.header(a(), "Bulletins");
      BULLETINS.forEach((b, n) => x.at(6 + n * 2, 6).hot(String(n + 1), "  " + b.title, 15, 5, 11));
      x.at(14, 6).k(8, "Pick a number, or ESC to go back: ");
      this.send(x);
      const k = await this.key();
      if (k.key === "Escape" || k.key === "Enter") return;
      const n = k.ch !== null ? k.ch - 49 : -1;
      const b = BULLETINS[n];
      if (!b) continue;
      const y = this.header(a(), `Bulletin #${n + 1}`);
      y.at(5, 4).k(15, b.title).at(6, 4).k(5, "═".repeat(b.title.length));
      b.body.forEach((l, i) => y.at(8 + i, 4).k(7, l));
      this.send(y);
      await this.anyKey(20);
    }
  }

  async whosOnline() {
    const x = this.header(a(), "Who's online");
    x.at(6, 6).k(13, pad("Node", 8)).k(13, pad("Caller", 22)).k(13, pad("Speed", 10)).k(13, "Doing");
    x.at(7, 6).k(5, "─".repeat(60));
    x.at(8, 6).k(15, pad("1", 8)).k(11, pad(this.user, 22)).k(14, pad(String(this.io.speed), 10)).k(7, "Reading who's online");
    x.at(9, 6).k(15, pad("2", 8)).k(8, pad("—", 22)).k(8, pad("—", 10)).k(8, "Waiting for caller...");
    this.send(x);
    await this.anyKey(13);
  }

  async userList() {
    const x = this.header(a(), "User list");
    x.at(5, 4).k(13, pad("Handle", 22)).k(13, pad("From", 20)).k(13, "Level");
    x.at(6, 4).k(5, "─".repeat(56));
    const users = [[SYSOP, "under the stairs", "255"], ...CALLERS.map((c) => [c[0], c[1], "20"])];
    if (!this.guest) users.push([this.user, this.io.profile.city || "parts unknown", "10"]);
    users.forEach((u, n) => x.at(7 + n, 4).k(n === 0 ? 14 : 11, pad(u[0], 22)).k(3, pad(u[1], 20)).k(7, u[2]));
    this.send(x);
    await this.anyKey(18);
  }

  async pageSysop() {
    const x = this.header(a(), "Page sysop");
    x.at(6, 6).k(11, `Paging ${SYSOP}`);
    this.send(x);
    for (let i = 0; i < 5; i++) { this.send(a().k(15, " .").raw("\x07")); await this.io.drain(); await new Promise((r) => setTimeout(r, 500)); }
    const y = a();
    box(y, 9, 10, 60, 7, 13, "NO ANSWER");
    y.at(11, 13).k(15, `${SYSOP} is asleep under the stairs, next to the 486.`);
    y.at(12, 13).k(7, "He set the chat flag to \"only for emergencies\" in 1992.");
    y.at(13, 13).k(7, "Try leaving a oneliner. Or yelling down the stairs.");
    this.send(y);
    await this.anyKey(18);
  }

  async doors() {
    const x = this.header(a(), "Doors");
    box(x, 7, 12, 56, 7, 6, "UNDER CONSTRUCTION");
    x.at(9, 15).k(14, "The sysop is still installing them.");
    x.at(10, 15).k(7, "LORD, TradeWars and the trivia door are on floppies");
    x.at(11, 15).k(7, "somewhere in a shoebox. Patience, caller.");
    this.send(x);
    await this.anyKey(16);
  }

  async credits() {
    const x = this.header(a(), "Credits");
    const L: [number, string][] = [
      [15, "The art belongs to its artists. Every piece on this board was made"],
      [15, "by someone in the scene; their names are one keypress away (I)."],
      [7, ""],
      [11, "Archives preserved by Sixteen Colors (16colo.rs) and artpacks.org."],
      [7, "This board fetches only what you open, and caches it politely."],
      [7, ""],
      [13, "Font: IBM VGA 8x16 from the Ultimate Oldschool PC Font Pack by VileR"],
      [13, "(int10h.org), licensed CC BY-SA 4.0."],
      [7, ""],
      [7, "Board software, house pack CRAWL-01, the machine and the modem: Dial-Up."],
      [7, "All brand names here are invented."],
      [7, ""],
      [14, "Takedown requests: sysop@ (placeholder)"],
    ];
    L.forEach(([c, t], n) => x.at(5 + n, 5).k(c, t));
    this.send(x);
    await this.anyKey(20);
  }

  async confirmBye() {
    this.send(a().nl().at(23, 4).eol().k(14, "Log off? ").k(5, "[").k(15, "Y").k(5, "/").k(15, "n").k(5, "]").k(7, " "));
    const k = await this.key();
    return !(k.ch !== null && String.fromCharCode(k.ch).toLowerCase() === "n");
  }

  async goodbye() {
    const x = a().cls();
    x.at(3, 1); shadeBar(x, 79, 5);
    bigText(x, 6, 18, "SEE YA", [13, 5, 1], 8);
    x.at(11, 1); shadeBar(x, 79, 1);
    x.at(13, 1).k(15, center(`Thanks for calling, ${this.user}.`, 79));
    x.at(15, 1).k(3, center(QUOTES[Math.floor(Math.random() * QUOTES.length)], 79));
    x.at(18, 1).k(8, center("The Crawlspace BBS · 555-0142 · call again after midnight", 79)).at(20, 1).reset();
    this.send(x);
    await this.io.drain();
    await new Promise((r) => setTimeout(r, 900));
  }

  async timesUp() {
    this.io.clearOutput();
    this.io.client.overlay(null);
    this.io.client.setMode({ cols: 80, ice: false, ninePixel: true });
    const x = a().cls();
    box(x, 8, 15, 50, 8, 12, "TIME'S UP");
    x.at(10, 18).k(15, "Your 60 minutes are up for this call.");
    x.at(12, 18).k(7, "Other callers need the line too, you know.");
    x.at(13, 18).k(7, "Call back after a snack.");
    this.send(x);
    await this.io.drain();
    await new Promise((r) => setTimeout(r, 2500));
  }

  // ── file areas ─────────────────────────────────────────────────
  async files() {
    const mode = this.io.entry.mode;
    if (mode === "year1993") return this.yearPacks(1993);
    if (mode === "groups") return this.groupList();
    return this.yearList();
  }

  async loading(msg: string) {
    this.send(a().at(23, 4).eol().k(8, "░▒▓ ").k(11, msg).k(8, " ▓▒░"));
  }

  async yearList() {
    let idx = 0;
    for (;;) {
      const x = this.header(a(), "File areas", "by year");
      this.send(x);
      await this.loading("Spinning up the archive drive...");
      let years: { year: number; packs: number }[] = [];
      let failed = false;
      try { years = await getYears(); } catch { failed = true; }
      const items = [
        { text: `${pad("HOUSE", 8)}${pad("CRAWL-01 · the board's own pack", 44)}7 files`, color: 14 },
        ...years.map((y) => ({ text: `${pad(String(y.year), 8)}${pad("Art packs released in " + y.year, 44)}${y.packs} packs`, color: 11 })),
      ];
      const y = a().at(5, 4).k(13, pad("Area", 9) + pad("Description", 44) + "Size").at(6, 4).k(5, "─".repeat(70));
      if (failed) y.at(20, 4).k(12, "Archive drive offline. Only the house pack is available right now.");
      y.at(23, 4).eol().k(8, "↑↓ move · ENTER open · ESC main menu");
      this.status(y);
      this.send(y);
      const r = await this.lightbar({ row: 7, col: 3, width: 74, height: 11, items, index: idx });
      if (!r) return;
      idx = r.index;
      if (r.index === 0) await this.packScreen({ name: HOUSE_PACK, year: 1994, groups: ["crawlspace"] });
      else await this.yearPacks(years[r.index - 1].year);
    }
  }

  async pagedPacks(title: string, sub: string, load: (page: number) => Promise<Page<PackSummary>>) {
    let page = 1, idx = 0;
    for (;;) {
      this.send(this.header(a(), title, sub));
      await this.loading("Reading the file area index...");
      let p: Page<PackSummary>;
      try { p = await load(page); } catch (e) { await this.errorScreen(String((e as Error).message)); return; }
      const items: { text: string; color: number; dim?: boolean; act?: string }[] = [];
      if (p.page > 1) items.push({ text: "◄ previous page", color: 13, act: "prev" });
      for (const s of p.items) items.push({ text: `${pad(s.name.toUpperCase(), 18)}${pad(s.groups.join(", ") || "—", 44)}${s.year}`, color: 11 });
      if (p.page < p.pages) items.push({ text: "► next page", color: 13, act: "next" });
      const x = a().at(5, 4).k(13, pad("Pack", 18) + pad("Group", 44) + "Year").at(6, 4).k(5, "─".repeat(70));
      x.at(23, 4).eol().k(8, `area page ${p.page}/${p.pages} · ${p.total} packs · ENTER open · ESC back`);
      this.status(x);
      this.send(x);
      const r = await this.lightbar({ row: 7, col: 3, width: 74, height: 14, items, index: idx });
      if (!r) return;
      const it = items[r.index];
      if (it.act === "next") { page++; idx = 0; continue; }
      if (it.act === "prev") { page--; idx = 0; continue; }
      idx = r.index;
      const s = p.items[r.index - (p.page > 1 ? 1 : 0)];
      await this.packScreen(s);
    }
  }

  yearPacks(year: number) {
    return this.pagedPacks(`File area ${year}`, `${year}`, (page) => getYearPacks(year, page));
  }

  async groupList() {
    let page = 1, idx = 0;
    for (;;) {
      this.send(this.header(a(), "Group Vault", "by group"));
      await this.loading("Opening the vault...");
      let p;
      try { p = await getGroups(page); } catch (e) { await this.errorScreen(String((e as Error).message)); return; }
      const items: { text: string; color: number; act?: string; name?: string }[] = [];
      if (page === 1) items.push({ text: `${pad("CRAWLSPACE", 40)}house pack`, color: 14, name: "__house" });
      if (p.page > 1) items.push({ text: "◄ previous page", color: 13, act: "prev" });
      for (const g of p.items) items.push({ text: `${pad(g.name.toUpperCase(), 40)}${g.releases} releases`, color: 11, name: g.name });
      if (p.page < p.pages) items.push({ text: "► next page", color: 13, act: "next" });
      const x = a().at(5, 4).k(13, pad("Group", 40) + "Releases").at(6, 4).k(5, "─".repeat(70));
      x.at(23, 4).eol().k(8, `vault page ${p.page}/${p.pages} · ${p.total} groups · ENTER open · ESC back`);
      this.status(x);
      this.send(x);
      const r = await this.lightbar({ row: 7, col: 3, width: 74, height: 14, items, index: idx });
      if (!r) return;
      const it = items[r.index];
      if (it.act === "next") { page++; idx = 0; continue; }
      if (it.act === "prev") { page--; idx = 0; continue; }
      idx = r.index;
      if (it.name === "__house") { await this.packScreen({ name: HOUSE_PACK, year: 1994, groups: ["crawlspace"] }); continue; }
      const name = it.name!;
      await this.pagedPacks(`Group: ${name}`, `${MIN_YEAR}-${MAX_YEAR}`, async () => {
        const all = await getGroupPacks(name);
        return { items: all, page: 1, pages: 1, total: all.length };
      });
    }
  }

  estimate(size: number | null) {
    if (size == null) return "  ?";
    const s = Math.ceil((size * 10) / this.io.speed);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  }

  async packScreen(s: PackSummary, startFile?: string) {
    this.send(this.header(a(), `Pack ${s.name.toUpperCase()}`, String(s.year)));
    await this.loading("Retrieving pack listing...");
    let pack: PackInfo;
    try { pack = await getPack(s.name, s.groups); } catch (e) { await this.errorScreen(String((e as Error).message)); return; }
    if (!pack.groups.length) pack.groups = s.groups;
    let diz: Uint8Array | null = null;
    if (pack.fileId) { try { diz = parseSauce(await getFile(pack.name, pack.fileId)).body; } catch { diz = null; } }
    const viewable = pack.files.filter((f) => f.viewable);
    if (startFile) {
      const i = viewable.findIndex((f) => f.name.toLowerCase() === startFile.toLowerCase());
      if (i >= 0) await this.viewer(pack, viewable, i);
    }
    let idx = 0;
    for (;;) {
      const x = this.header(a(), `Pack ${pack.name.toUpperCase()}`, `${pack.year} · ${pack.groups.join(", ") || "unknown group"}`);
      // FILE_ID.DIZ, drawn line by line into the top area
      if (diz) {
        const lines = splitLines(diz).slice(0, 10);
        lines.forEach((l, n) => { x.at(4 + n, 3).reset(); x.bytes(l); x.reset(); });
      } else x.at(5, 4).k(8, "(no FILE_ID.DIZ in this pack)");
      x.at(14, 3).k(13, pad("File", 14) + rpad("Size", 8) + "  " + pad("Artist", 26) + rpad(`@${this.io.speed}`, 9)).at(15, 3).k(5, "─".repeat(64));
      x.at(23, 4).eol().k(8, "ENTER view · ESC back · dim files are not viewable on this terminal");
      this.status(x);
      this.send(x);
      const items = pack.files.map((f) => ({
        text: `${pad(f.name, 14)}${rpad(f.size != null ? String(f.size) : "?", 8)}  ${pad(f.artists.join(", ") || "—", 26)}${rpad(this.estimate(f.size), 8)}`,
        color: /\.(ans|ice|bin)$/i.test(f.name) ? 11 : 3, dim: !f.viewable,
      }));
      const r = await this.lightbar({ row: 16, col: 2, width: 68, height: 6, items, index: idx });
      if (!r) return;
      idx = r.index;
      const f = pack.files[r.index];
      if (!f.viewable) {
        this.send(a().at(23, 4).eol().k(12, `${f.name}: not viewable on this terminal.`));
        await new Promise((res) => setTimeout(res, 900));
        continue;
      }
      await this.viewer(pack, viewable, viewable.indexOf(f));
    }
  }

  // ── viewer ─────────────────────────────────────────────────────
  async viewer(pack: PackInfo, files: PackFile[], idx: number) {
    const io = this.io;
    const restore = () => { io.client.overlay(null); io.client.setMode({ cols: 80, ice: false, ninePixel: true }); };
    for (;;) {
      const f = files[idx];
      this.send(a().cls().at(12, 1).k(8, center(`░▒▓ retrieving ${f.name} from the stacks ▓▒░`, 79)));
      let bytes: Uint8Array;
      try { bytes = await getFile(pack.name, f.name); } catch (e) { restore(); await this.errorScreen(`${f.name}: ${(e as Error).message}`); return; }
      await io.drain();
      const art = parseSauce(bytes);
      const mode = modeFor(f.name, art.sauce);
      io.client.setMode(mode);
      io.client.markTop();
      io.send(/\.bin$/i.test(f.name) ? binToAnsi(art.body, mode.cols) : art.body);
      const seen = `${pack.name}/${f.name}`;
      const before = maxSpeed(io.profile);
      if (!io.profile.filesSeen.includes(seen)) { io.profile.filesSeen.push(seen); io.save(); }
      const unlocked = maxSpeed(io.profile) !== before ? maxSpeed(io.profile) : 0;
      let finished = false, info = false;
      const showInfo = () => io.client.overlay(info ? infoPanel(pack, f, art.sauce, bytes.length, mode, unlocked) : null);
      let next = 0;
      while (!next) {
        const k = finished ? await io.key() : await io.keyOrDrain();
        if (k === null) { finished = true; continue; }
        const c = k.ch !== null ? String.fromCharCode(k.ch).toUpperCase() : "";
        if (k.key === " " && !finished) { if (io.isPaused()) io.resume(); else io.pause(); continue; }
        if (k.key === "Enter") { io.flush(); continue; }
        if (k.key === "Escape") {
          if (info) { info = false; showInfo(); continue; }
          io.clearOutput(); io.resume(); restore(); return;
        }
        if (c === "I") { info = !info; showInfo(); continue; }
        if (c === "N" && idx < files.length - 1) { next = 1; break; }
        if (c === "P" && idx > 0) { next = -1; break; }
        const rows = io.client.rows();
        switch (k.key) {
          case "ArrowUp": io.client.scroll(1); break;
          case "ArrowDown": io.client.scroll(-1); break;
          case "PageUp": io.client.scroll(rows - 1); break;
          case "PageDown": io.client.scroll(-(rows - 1)); break;
          case "Home": io.client.scrollTo("top"); break;
          case "End": io.client.scrollTo("bottom"); break;
        }
      }
      io.clearOutput(); io.resume(); io.client.overlay(null);
      idx += next;
    }
  }

  async run(): Promise<void> {
    try {
      if (this.io.deepLink) return await this.runDeepLink(this.io.deepLink);
      await this.login();
      await this.lastCallers();
      await this.news();
      await this.oneliners();
      await this.mainMenu();
      await this.goodbye();
    } catch (e) {
      if (e instanceof Aborted && e.reason === "timeup") { await this.timesUp(); return; }
      throw e;
    }
  }

  async runDeepLink(dl: DeepLink) {
    const p = this.io.profile;
    if (p.handle) { this.user = p.handle; this.guest = false; }
    this.send(a().cls().at(12, 1).k(11, center(`Welcome back, ${this.user}. Express login to ${dl.pack.toUpperCase()}...`, 79)));
    await this.io.drain();
    await this.packScreen({ name: dl.pack, year: dl.year, groups: [] }, dl.file);
    await this.mainMenu();
    await this.goodbye();
  }
}

function splitLines(b: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let s = 0;
  for (let i = 0; i <= b.length; i++) {
    if (i === b.length || b[i] === 0x0a) {
      let e = i; if (e > s && b[e - 1] === 0x0d) e--;
      // strip cursor-clearing / positioning sequences so the DIZ stays in its box
      const line = Array.from(b.subarray(s, e));
      const clean: number[] = [];
      for (let j = 0; j < line.length && clean.length < 400; j++) {
        if (line[j] === 0x1b && line[j + 1] === 0x5b) {
          let k = j + 2; while (k < line.length && !(line[k] >= 0x40 && line[k] <= 0x7e)) k++;
          if (line[k] === 0x6d) for (let q = j; q <= k; q++) clean.push(line[q]);
          else if (line[k] === 0x43) for (let q = j; q <= k; q++) clean.push(line[q]);
          j = k; continue;
        }
        if (line[j] >= 0x20 || line[j] === 0x09 || line[j] < 0x07 || (line[j] > 0x0d && line[j] !== 0x1b)) clean.push(line[j]);
      }
      out.push(new Uint8Array(clean.length > 0 ? clean : []).subarray(0, 300));
      s = i + 1;
    }
  }
  return out.map((l) => truncateVisible(l, 74));
}

/** Keep at most `n` visible characters (SGR sequences don't count). */
function truncateVisible(l: Uint8Array, n: number) {
  let vis = 0, i = 0;
  for (; i < l.length; i++) {
    if (l[i] === 0x1b) { while (i < l.length && l[i] !== 0x6d && l[i] !== 0x43) i++; continue; }
    if (++vis > n) break;
  }
  return l.subarray(0, i);
}

export function modeFor(name: string, s: Sauce | null): TermMode {
  const isBin = /\.bin$/i.test(name);
  let cols = 80;
  if (s) {
    if (isBin && s.dataType === 5 && s.fileType > 0) cols = s.fileType * 2;
    else if (s.dataType === 1 && s.tInfo1 > 80 && s.tInfo1 <= 320 && (s.fileType === 1 || s.fileType === 2)) cols = s.tInfo1;
  } else if (isBin) cols = 160;
  return {
    cols,
    ice: /\.ice$/i.test(name) || isBin || !!s?.ice,
    ninePixel: s?.letterSpacing !== 8,
  };
}

/** .BIN: raw char/attribute pairs -> ANSI with wrap at `cols`. */
export function binToAnsi(b: Uint8Array, cols: number): Uint8Array {
  const out: number[] = [];
  let last = -1;
  const push = (s: string) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
  for (let i = 0; i + 1 < b.length; i += 2) {
    let ch = b[i];
    const at = b[i + 1];
    if ([0x07, 0x08, 0x09, 0x0a, 0x0d, 0x1a, 0x1b].includes(ch)) ch = 0x20;
    if (at !== last) {
      const fg = at & 15, bg = (at >> 4) & 15;
      push(`\x1b[0${fg & 8 ? ";1" : ""}${bg & 8 ? ";5" : ""};3${ANSI_VGA[fg & 7]};4${ANSI_VGA[bg & 7]}m`);
      last = at;
    }
    out.push(ch);
  }
  void cols;
  push("\x1b[0m");
  return new Uint8Array(out);
}

function infoPanel(pack: PackInfo, f: PackFile, s: Sauce | null, size: number, mode: TermMode, unlocked: number) {
  const x = a();
  const W = 52, R = 6, C = 15;
  box(x, R, C, W, 14, 11, "FILE INFO");
  const row = (n: number, label: string, val: string, vc = 15) => x.at(R + 1 + n, C + 3).k(3, pad(label, 9)).k(vc, pad(val || "—", W - 14));
  row(1, "Title", s?.title || f.name);
  row(2, "Artist", s?.author || f.artists.join(", "));
  row(3, "Group", s?.group || pack.groups.join(", "));
  row(4, "Pack", pack.name.toUpperCase());
  row(5, "Year", String(pack.year) + (s?.date ? `  (${sauceDate(s.date)})` : ""));
  row(6, "Font", `${s?.tInfoS || "IBM VGA"} · ${mode.ninePixel ? "9px" : "8px"}${mode.ice ? " · iCE" : ""}`);
  row(7, "Size", `${size} bytes · ${mode.cols} cols${s ? "" : " · no SAUCE"}`);
  row(8, "File", f.name, 7);
  if (unlocked) x.at(R + 10, C + 3).k(10, pad(`Your modem can now do ${unlocked}! (TELEWIRE: S)`, W - 6));
  x.at(R + 12, C + 3).k(8, "SPC pause ENTER finish N/P next/prev ESC");
  return x.build();
}

export async function runBoard(io: HostIO) {
  await new Board(io).run();
}
