// DEAD CARRIER — the virtual host. Writes bytes, reads keys. Nothing else.
import { Ansi, a, bigText, box, center, chromeText, pad, rpad, shadeBar, stairwell } from "./ansi";
import { ATTIC_UNLOCK, type HostIO, type DeepLink, type KeyHint } from "./io";
import type { Key } from "@/machine/keyboard";
import { Aborted } from "@/machine/keyboard";
import { maxSpeed } from "@/machine/storage";
import { fileCached, packCached, fileTitle, prefetchFile, getFile, getGroupPacks, getGroups, getPack, getYearPacks, getYears, MAX_YEAR } from "@/data/archive";
import { HOUSE_ANIMATIONS, HOUSE_PACK, isHousePack, houseName } from "@/data/housepack";
import type { PackFile, PackInfo, PackSummary, Page } from "@/data/types";
import { parseSauce, sauceDate, type Sauce } from "@/term/sauce";
import { prepareArt, type Prepared } from "@/term/prepare";
export { modeFor } from "@/term/prepare";
import { ANSI_VGA, type TermMode } from "@/term/terminal";
import { artViewed, net, newSessionId, setLiveSession, timeAgo, type CallerInfo } from "@/data/net";
import { checkHandle, checkOneliner } from "@/lib/filter";
import { doorMenu } from "./door";
import { sysopChat } from "./chat";
import { configFor, type BoardConfig } from "./config";
import { cornerDoor } from "./corner";
import { RELEASES, RELEASE_GROUPS, nfoBytes, nfoLines, nfoPage, dizBytes, GUEST_CREDITS, COURIER_LOGS, tagOrder, orderedTags } from "./warez-catalog";
import { FAMILY_SHELF, familyAllowed, pictureOfDay } from "@/data/family-shelf";
import { discovered, jukebox, guestShelf, toggleGuestFavorite } from "@/data/browsing";
import { directLookup } from "@/data/archive";
import { strobeFont } from "@/term/board-font";
import { Terminal } from "@/term/terminal";
import { MUSIC } from "@/machine/programs";
import { boardLogo, drawMenu, menuSelection, listChrome, goodbyeDesign, strobeMotion } from "./designs";
import {phoneBills} from "./bill";
import {timeBank} from "./time-bank";
import { houseLines } from "./house-lines";
import { ScreenRecord } from "@/lib/house";
import {composePostcard} from "./postcard";
import {sceneBulletin} from "./scene";
import type {ScenePack} from "@/lib/scene";
import {mailbox} from "./mail";
import {callScan} from "./new-scan";
import { yourRecord, promotionNotice } from "./record";
import { wall, innerCircle } from "./wall";
import { ACCESS, accessLevel } from "@/lib/access";
import {scanPreview,scanCaption,firstVisibleRow} from './quick-scan';

export function wrapCourier(text:string){const lines:string[]=[];let line="";for(const word of text.split(/\s+/)){if((line+" "+word).trim().length>70){lines.push(line);line=word;}else line=(line+" "+word).trim();}if(line)lines.push(line);return lines;}
export function releasedInMonth(pack:PackSummary,month:number){if(pack.year<1990||pack.year>1996)return false;const date=/^\d{4}-(\d{2})/.exec(String(pack.released??""));if(date)return +date[1]===month;const suffix=/(\d{2})(\d{2})$/.exec(pack.name);return !!suffix&&+suffix[1]===month&&+suffix[2]===pack.year%100;}
const SYSOP = "Static";
/** VOID//NODE's new-user password. It is printed at the end of DEAD CARRIER credits screen. */
export const VOID_NUP = "STAIRWELL";
interface Skin { name: string; a: number; b: number; c: number; line: number; hot: [number, number, number] }
const CRAWL_SKIN: Skin = { name: "DEAD CARRIER", a: 11, b: 13, c: 3, line: 8, hot: [15, 13, 11] };
const VOID_SKIN: Skin = { name: "VOID//NODE", a: 12, b: 7, c: 4, line: 8, hot: [15, 4, 7] };
const NAV: KeyHint[] = [{ label: "↑", key: "ArrowUp" }, { label: "↓", key: "ArrowDown" }, { label: "ENTER", key: "Enter" }, { label: "ESC", key: "Escape" }];
const hk = (c: string, label = c): KeyHint => ({ label, key: c, ch: c });
const ANY: KeyHint[] = [{ label: "CONTINUE", key: "Enter" }];
const CALLERS = [
  ["Phosphor", "Lakewood", "11:52p"], ["Lord Cyan", "Port Ellis", "11:20p"], ["Ms. Halftone", "Grayson", "10:47p"],
  ["Dr. Baud", "Milltown", "10:02p"], ["Nyx", "Somerset", "9:31p"], ["Kilobyte Kid", "Lakewood", "8:58p"], ["Parity Error", "Ashby", "8:15p"],
];
const ONELINERS = [
  ["Phosphor", "anyone got the new latchkey disk? 9600 is too slow for this"],
  ["Nyx", "static pls install a door game already"],
  ["Lord Cyan", "greetz to everyone on node 2 at 3am"],
  ["Dr. Baud", "my mom picked up the phone mid-download AGAIN"],
  ["Ms. Halftone", "shade blocks are a lifestyle"],
  ["Kilobyte Kid", "first time caller, long time lurker"],
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Draw text with BBS pipe color codes |01-|15. */
function pipes(x: Ansi, s: string, base = 7) {
  let c = base;
  for (const part of s.split(/(\|(?:0[1-9]|1[0-5]))/)) {
    const m = /^\|(\d\d)$/.exec(part);
    if (m) c = +m[1]; else if (part) x.k(c, part);
  }
  return x.reset();
}

/** Static answers the nth page of a call when n is a multiple of 4, and always on the first page after 20 files. */
export function sysopAnswers(pageNo: number, filesSeen: number, chattedAfter20: boolean) {
  return (filesSeen >= 20 && !chattedAfter20) || pageNo % 4 === 0;
}

export class Board {
  user = "Guest";
  guest = true;
  online = true;
  node: number;
  caller: CallerInfo | null = null;
  private session = newSessionId();
  private callSession: string | undefined;
  mailWaiting=0;
  clockExempt=false;
  billWaiting=false;
  async bills(waiting=false){await phoneBills(this,waiting);}
  async printBill(b:import("@/lib/bill").Bill){await this.io.client.printBill?.(b);}
  private clockWarning=0;
  async bankRead(withdraw=false){const r=await net(withdraw?"withdraw":"timeBank",{guest:this.guest,callSession:this.callSession,minutes:15,active:this.io.client.active?.()??true});if(r&&!r.error&&!this.guest){this.clockExempt=r.exempt??this.clockExempt;this.io.client.access?.({speed:this.io.speed,remainingSeconds:r.remainingSeconds,level:this.level,exempt:this.clockExempt});}return r;}
  async clockCheck(){if(!this.clockExempt&&this.io.timeLeftMs()<=0)throw new Aborted("timeup");const left=this.io.timeLeftMs()/60000;if(!this.clockExempt&&left<=5&&(this.clockWarning===0||(left<=1&&this.clockWarning===5))){this.clockWarning=left<=1?1:5;this.send(a().at(25,1).k(14,pad(`${this.config.sysop}: ${this.clockWarning} minute${this.clockWarning===1?"":"s"} left. Time bank is K.`,79)));}}
  async mail(){await mailbox(this);}
  ioEntryId(){return this.io.entry.id;}
  clientOverlay(b:Uint8Array|null){this.io.client.overlay(b);}
  shareLink(url:string|null){this.io.client.shareLink?.(url);}
  ioTimeout(ms:number){return this.io.keyTimeout(ms);}
  clearPending(){this.io.clearOutput();}
  async newPacks(names:string[]){if(!names.length)return;await this.pagedPacks("Packs new to you","archive",async()=>({items:names.map(name=>({name,year:1993,groups:[]})),page:1,pages:1,total:names.length}));}
  get level(){return accessLevel(this.guest?null:this.caller?.level);}
  private doing = "logging on";
  private lastBeat = 0;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  sk: Skin;
  config: BoardConfig;
  colorBack = false;
  creditsLeft = GUEST_CREDITS;
  tagged = new Set<string>();
  private musicQueue: {pack:string;file:string;artist:string}[]=[];
  /** The current screen as sent (since the last clear), so line noise can be repainted; and a depth of places noise must not reach. */
  private record = new ScreenRecord(); hush = 0;
  private onHouse(e: "noise" | "rattle" | "yelled") {
    if (this.hush > 0 && e !== "yelled") return false;
    if (e === "noise") { setTimeout(async () => { await this.io.drain(); await sleep(250); const r = this.record.replay(); if (r) this.io.send(r); }, 30); return true; }
    const l = houseLines(this.io.entry.id);
    this.send(a().raw("\x1b[s").at(25, 1).k(e === "rattle" ? 14 : 10, pad(e === "rattle" ? l.rattle : l.yelled, 79)).raw("\x1b[u"));
    return true;
  }
  async hushed<T>(f: () => Promise<T>): Promise<T> { this.hush++; try { return await f(); } finally { this.hush--; } }
  constructor(private io: HostIO) {
    if (io.send) { const raw = io.send.bind(io); io.send = (b) => { this.record.push(b); raw(b); }; }
    io.house?.listen((e) => this.onHouse(e));
    this.node = io.node; this.config=configFor(io.entry); const [aa,bb,cc]=this.config.colors; this.sk = io.entry.mode === "void" ? VOID_SKIN : {name:this.config.name,a:aa,b:bb,c:cc,line:8,hot:[15,bb,aa]}; }
  screenMode(m:Partial<TermMode>={cols:80,rows:25,ice:false,ninePixel:true}) {
    if(this.io.entry.id === "c93" && !this.colorBack) { const levels=[0,55,85,100,75,95,120,150,65,175,200,220,180,210,230,255]; m={...m,palette:Uint32Array.from(levels,v=>(0xff000000 | (v<<8) | Math.floor(v*.12))>>>0)}; }
    if(this.io.entry.id === "strobe" && !m.font)m={...m,font:strobeFont(),ninePixel:false};
    this.io.client?.setMode(m);
  }
  hint(k: KeyHint[]) { this.io.hint(k); }
  get filesSeen() { return Math.max(this.io.profile.filesSeen.length, this.io.profile.serverFiles ?? 0); }

  // ── presence ───────────────────────────────────────────────────
  async beat(doing?: string) {
    if (doing) this.doing = doing;
    this.lastBeat = Date.now();
    const r = await net("beat", { session: this.session, doing: this.doing, speed: this.io.speed, guest: this.guest,board:this.io.entry.id, callSession:this.callSession,active:this.io.client.active?.()??true });
    if(r?.time&&!(this.guest))this.io.client.access?.({speed:this.io.speed,remainingSeconds:r.time.remainingSeconds,level:this.level,exempt:this.clockExempt});
    if (r?.online) { const me = r.online.findIndex((o: any) => o.me); if (me >= 0) this.node = me + 1; }
    return r;
  }
  setDoing(d: string) {
    if (d === this.doing) return;
    this.doing = d;
    if (this.online && this.beatTimer && Date.now() - this.lastBeat > 4000) void this.beat();
  }
  startPresence() {
    if (!this.online || this.beatTimer) return;
    setLiveSession(this.session);
    void this.beat();
    this.beatTimer = setInterval(() => void this.beat(), 30_000);
  }
  stopPresence() {
    if (!this.beatTimer) return;
    clearInterval(this.beatTimer); this.beatTimer = null;
    setLiveSession(null);
    void net("leave", { session: this.session,callSession:this.callSession,active:this.io.client.active?.()??true });
  }
  offlineNote(x: Ansi, row: number) {
    return x.at(row, 4).k(12, "░ the message base is offline ░").k(8, " this is the printout Static taped up");
  }
  become(c: CallerInfo) {
    this.user = c.handle; this.guest = false; this.caller = c;
    Object.assign(this.io.profile, { handle: c.handle, city: c.city, serverFiles: c.files,accessLevel:accessLevel(c.level) });
    this.io.save();
  }
  async suspended(): Promise<never> {
    const x = a().cls();
    box(x, 8, 14, 52, 7, 12, "ACCOUNT SUSPENDED");
    x.at(10, 17).k(15, "Static has pulled your access to this board.");
    x.at(11, 17).k(7, "Guests can still look around. Call back as GUEST.");
    this.send(x);
    await this.io.drain(); await sleep(2500);
    throw new Aborted("hangup");
  }
  async ask(row: number, label: string, max: number, mask = false) {
    this.send(a().at(row, 4).eol().k(13, label).k(5, ": "));
    return this.input(max, { mask });
  }

  // ── output helpers ─────────────────────────────────────────────
  send(x: Ansi | Uint8Array) { this.io.send(x instanceof Ansi ? x.build() : x); }
  async key(): Promise<Key> {for(;;){const k=await this.io.keyTimeout(1000);if(!this.clockExempt&&this.io.timeLeftMs()<=0)throw new Aborted("timeup");if(k)return k;}}

  async anyKey(row?: number) {
    const x = a();
    if (row) x.at(row, 1); else x.nl();
    x.k(8, "  ░▒▓").k(5, "[").k(15, " press any key ").k(5, "]").k(8, "▓▒░");
    this.send(x);
    this.hint(ANY);
    await this.key();
    this.io.clearOutput();
    this.send(a().raw("\r").eol());
  }

  /** Line input with remote echo through the modem. */
  async input(max: number, opts: { mask?: boolean; fg?: number } = {}): Promise<string> {
    let s = "";
    this.hint([{ label: "type", key: "", text: true }, { label: "⌫", key: "Backspace" }, { label: "ENTER", key: "Enter" }]);
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
    this.screenMode();
    if (!["attic","void"].includes(this.io.entry.id)) return listChrome(this.io.entry.id,this.config.name,title,sub);
    x.cls().at(1, 1);
    shadeBar(x, 79, this.sk.a&7);
    x.at(2, 3).k(this.sk.a, this.sk.name).k(this.sk.line, " ── ").k(this.sk.b, title.slice(0,Math.max(12,70-this.sk.name.length)));
    if (sub) x.at(2, 79 - Math.min(24,sub.length)).k(this.sk.c, sub.slice(0,24));
    x.at(3, 1).k(this.sk.line, "─".repeat(79));
    return x;
  }

  status(x: Ansi, row = 24) {
    if(row===24 && ["vault","strobe","crawl"].includes(this.io.entry.id)) row=25;
    const left = Math.max(0, Math.min(this.io.entry.id==="maple"?30:60,Math.ceil(this.io.timeLeftMs() / 60000)));
    x.at(row, 1).c(15, 1).t(pad(` ${this.user} / ${this.level}${this.mailWaiting?" MAIL":""}`, 38)).c(11, 1).t(pad(`node ${this.node}`, 8))
      .c(14, 1).t(pad(`${this.io.speed} bps`, 12)).c(15, 1).t(rpad(`${left} min `, 21)).reset();
    return x;
  }

  /** MAPLE RIDGE's one answer for anything off the reviewed shelf, in Mr. Hutchins's voice. */
  async clubRefusal() {
    const x = a().reset().c(15, 1).cls();
    box(x, 7, 10, 60, 10, 15, "CLUB SHELF", true, 1);
    x.at(9, 14).c(14, 1).t("Mr. Hutchins:");
    x.at(11, 14).c(15, 1).t("I'm sorry, that picture isn't on our club-approved");
    x.at(12, 14).c(15, 1).t("shelf. Our reviewers choose pieces the whole family");
    x.at(13, 14).c(15, 1).t("can enjoy. Do try the Picture of the Day instead.");
    x.at(15, 14).c(11, 1).t("Thank you for understanding.");
    this.send(x);
    await this.anyKey(18);
    this.send(a().reset().cls());
  }

  async errorScreen(what: string) {
    const x = a().cls();
    box(x, 7, 14, 52, 10, 12, "CARRIER TROUBLE");
    x.at(9, 17).k(15, "The archive drive didn't answer.");
    x.at(11, 17).k(7, pad(what, 46));
    x.at(13, 17).k(3, "The sysop has been notified (he's asleep).");
    x.at(14, 17).k(3, "The house pack DC-01 is always on line.");
    this.send(x);
    await this.anyKey(18);
  }

  // ── lightbar ───────────────────────────────────────────────────
  async lightbar(o: { row: number; col: number; width: number; height: number; items: { text: string; color: number; dim?: boolean }[]; index?: number; hotkeys?: string; highlight?: (index:number) => void; refresh?: () => boolean; tag?: (index:number) => string }): Promise<{ index: number; key?: string } | null> {
    const { row, col, width, height, items } = o;
    if(this.config.style==='prompt') {
      let page=0;
      for(;;){const x=a();items.slice(page*height,(page+1)*height).forEach((it,n)=>x.nl().k(10,pad(`${page*height+n+1}. ${it.text}`,width).replace(/ {3,}/g,m=>".".repeat(m.length))));x.nl().k(2,pad(`Page ${page+1} / R n read / N next / P previous / T n tag / Q quit`,width));this.send(x);this.send(a().nl().k(10,'Command (?=help): '));const command=(await this.input(30,{fg:10})).toUpperCase();this.io.clearOutput();if(command==='Q'||command==='')return null;if(command==='N'){page=Math.min(Math.max(0,Math.ceil(items.length/height)-1),page+1);continue;}if(command==='P'){page=Math.max(0,page-1);continue;}if(command==='V'&&o.hotkeys?.includes('V'))return {index:0,key:'V'};const m=/^(?:R|T)?\s*(\d+)$/.exec(command);if(m){const n=+m[1]-1;if(n>=0&&n<items.length)return {index:n,...(command.startsWith('T')?{key:' '}:{} )};}}
    }
    let i = Math.max(0, Math.min(items.length - 1, o.index ?? 0));
    let top = Math.floor(i / height) * height;
    const line = (n: number, sel: boolean) => {
      const x = a().at(row + (n - top), col);
      const it = items[n];
      if (!it) return x.reset().rep(" ", width);
      return sel ? x.c(15, 1).t(pad(" " + it.text, width)) : x.c(it.dim ? 8 : this.io.entry.id==="maple"?15:it.color,this.io.entry.id==="maple"?1:0).t(pad(" " + it.text, width));
    };
    const page = () => {
      const x = a();
      for (let r = 0; r < height; r++) x.bytes(line(top + r, top + r === i).build());
      const pages = Math.max(1, Math.ceil(items.length / height));
      x.at(Math.min(22,row + height), col).k(8, pad(`page ${Math.floor(top / height) + 1}/${pages}  ·  ${items.length} entries`, width));
      this.send(x);
    };
    if (!items.length) { this.send(a().at(row, col).k(8, "  (nothing here)")); }
    page();
    this.hint([...NAV, { label: "PGUP", key: "PageUp" }, { label: "PGDN", key: "PageDown" }, ...[...(o.hotkeys ?? "")].map((c) => hk(c))]);
    let highlightAt = Date.now(), highlighted = false;
    for (;;) {
      const k = o.highlight || o.refresh ? await this.io.keyTimeout(200) : await this.key();
      if (!k) {
        if(!highlighted && Date.now()-highlightAt >= 400) { highlighted=true; o.highlight?.(i); }
        if(o.refresh?.()) page();
        continue;
      }
      if(k.ch===32 && o.tag && items[i]){items[i].text=o.tag(i);this.send(line(i,true));continue;}
      const prev = i;
      if (k.key === "Tap" && k.tapRow) {
        const n = top + (k.tapRow - row);
        if (k.tapRow >= row && k.tapRow < row + height && n < items.length) {
          if (n === i) { this.io.clearOutput(); return { index: i }; }
          i = n; this.send(a().bytes(line(prev, false).build()).bytes(line(i, true).build()));
        }
        continue;
      }
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
      highlightAt=Date.now(); highlighted=false;
      const ntop = Math.floor(i / height) * height;
      if (ntop !== top) { top = ntop; page(); }
      else this.send(a().bytes(line(prev, false).build()).bytes(line(i, true).build()));
    }
  }

  // ── login ──────────────────────────────────────────────────────
  logo(x: Ansi) {
    x.cls();
    if (this.sk === VOID_SKIN) {
      // VOID//NODE: red chrome that bleeds down into static
      x.at(1, 1); for (let c = 0; c < 79; c++) x.k(c % 7 === 3 ? 4 : 8, "▀");
      chromeText(x, 4, 12, "VOID", [15, 7, 12, 12, 4, 4], 4);
      x.at(5, 38).k(8, "//").at(6, 38).k(7, "//");
      chromeText(x, 4, 42, "NODE", [15, 7, 7, 7, 8, 8], 0);
      const drip = [13, 16, 21, 26, 29, 33];
      for (let r = 0; r < 4; r++) for (const c of drip) if ((c * 7 + r * 3) % 5 < 4 - r) x.at(7 + r, c).k(r ? 4 : 12, ["▓", "▒", "░", "·"][r]);
      x.at(12, 1).k(8, "░".repeat(79));
      x.at(13, 1).k(8, center("no sysop. no tagline. no mercy.", 79));
      x.at(14, 1).k(4, center(`node 0 · ${this.io.entry.number} · you were never here`, 79));
      return x;
    }
    this.screenMode();
    if(this.io.entry.id!=="attic") {
      x=boardLogo(this.io.entry.id,this.config.name);
      if(this.io.entry.id!=="c93")x.at(14,1).k(this.sk.b,center(this.config.tagline,79),this.io.entry.id==='maple'?1:0).at(16,1).k(this.sk.c,center(`sysop: ${this.config.sysop} / ${this.io.entry.number}`,79),this.io.entry.id==='maple'?1:0);
      return x;
    }
    chromeText(x,4,20,'THE ATTIC',[15,14,6,6,7,7],8);
    return x;
  }

  async login(): Promise<void> {
    this.send(this.logo(a()).at(17, 1));
    if(this.io.entry.id === "crawl") {
      this.send(a().at(19,8).hot("L","ogin",15,7,12).t("  ").hot("A","pply",15,7,12).t("  ").hot("G","uest",15,7,11).t("  ").hot("H","ang up",15,7,7));
      this.hint("LAGH".split("").map(c=>hk(c)));
      for(;;){const k=await this.key();const c=String.fromCharCode(k.ch??0).toUpperCase();if(c==="G"){this.io.clearOutput();this.guest=true;return;}if(c==="H")throw new Aborted("hangup");if(c==="A"){this.online=!!(await net("hello"));await this.newUser();return;}if(c==="L")break;}
    }
    const p = this.io.profile;
    const hello = await net("hello");
    this.online = !!hello && !hello.error;
    const known: CallerInfo | null = hello?.caller ?? null;
    if (known?.banned) await this.suspended();
    for (let tries = 0; ; tries++) {
      const x = a().at(17, 1).raw("\x1b[J");
      if (known) x.at(17, 4).k(7, "Welcome back, ").k(15, known.handle).k(7, ". ENTER logs you in, or type ").k(15, "NEW").k(7, " or ").k(15, "GUEST").k(7, ".");
      else x.at(17, 4).k(7, "Enter your handle, ").k(15, "NEW").k(7, " to apply, or ").k(15, "GUEST").k(7, " to look around.");
      if (!this.online) this.offlineNote(x, 23);
      x.at(19, 4).k(13, "Handle").k(5, ": ");
      this.send(x);
      const h = await this.input(20);
      if (!h) { if (known) return this.become(known); continue; }
      if (h.toUpperCase() === "GUEST") { this.user = "Guest"; this.guest = true; return; }
      if (h.toUpperCase() === "NEW") { await this.newUser(); return; }
      if (known && h.toLowerCase() === known.handle.toLowerCase()) return this.become(known);
      if (this.online) {
        if (await this.transfer(h)) return;
        if (tries > 6) throw new Aborted("hangup");
        await sleep(1200);
        continue;
      }
      // offline: accounts kept on this machine only
      if (p.handle && h.toLowerCase() === p.handle.toLowerCase()) {
        for (let pt = 0; pt < 3; pt++) {
          const pw = await this.ask(20, "Transfer phrase", 32, true);
          if (pw === (p.password ?? "")) { this.user = p.handle; this.guest = false; return; }
          this.send(a().at(22, 4).eol().k(12, "Wrong phrase.").raw("\x07"));
        }
        this.send(a().at(22, 4).eol().k(12, "Too many tries. Static's modem hangs up on you."));
        await this.io.drain();
        throw new Aborted("hangup");
      }
      this.send(a().at(22, 4).eol().k(14, `No caller named "${h}" on this machine. Type NEW to apply.`));
      if (tries > 6) throw new Aborted("hangup");
    }
  }

  /** A handle from another machine: prove it with the transfer phrase. */
  async transfer(h: string): Promise<boolean> {
    this.send(a().at(20, 4).eol().k(8, `Calling from a new machine? Type the transfer phrase for "${h.slice(0, 16)}".`));
    for (let pt = 0; pt < 3; pt++) {
      const ph = await this.ask(21, "Transfer phrase", 32, true);
      if (!ph) { this.send(a().at(20, 1).raw("\x1b[J")); return false; }
      this.send(a().at(22, 4).eol().k(8, "checking the user base..."));
      const r = await net("transfer", { handle: h, phrase: ph });
      if (r?.ok) {
        this.become(r.caller);
        this.send(a().at(22, 4).eol().k(10, "Phrase accepted. This machine knows you now."));
        await this.io.drain(); await sleep(900);
        return true;
      }
      const why = !r ? "The message base didn't answer." : r.status === 429 ? "Too many tries. Wait ten minutes."
        : r.why === "nouser" ? `No caller named "${h.slice(0, 16)}". Type NEW to apply.` : r.why === "nophrase" ? "That caller never set a transfer phrase."
        : r.why === "banned" ? "That account is suspended." : "Wrong transfer phrase.";
      this.send(a().at(22, 4).eol().k(12, why).raw(r?.why === "wrong" ? "\x07" : ""));
      if (r?.why !== "wrong") return false;
    }
    this.send(a().at(22, 4).eol().k(12, "Three strikes. Static's modem hangs up on you."));
    await this.io.drain();
    throw new Aborted("hangup");
  }

  async newUser() {
    const x = this.header(a(), "New caller application");
    x.at(22,4).k(this.sk.a,pad(`${this.config.sysop}: ${this.config.bulletins[0].body[0]}`,70));
    box(x, 5, 6, 68, 6, 12, "READ THIS");
    x.at(6, 9).k(15, "Do NOT reuse a real password anywhere on this board.")
      .at(7, 9).k(7, "Your handle lives on the board; this machine remembers you.")
      .at(8, 9).k(7, "A transfer phrase (optional) logs you in from other machines.")
      .at(9, 9).k(7, "Make it up. Write it on a sticky note like it's 1992.");
    if (!this.online) this.offlineNote(x, 22);
    this.send(x);
    for (;;) {
      let handle = "";
      while (!handle) {
        handle = await this.ask(12, "Handle (no real names)", 16);
        if (!handle) continue;
        const v = checkHandle(handle);
        let why = v.ok ? "" : v.why;
        if (v.ok && this.online) {
          const r = await net("check", { handle });
          if (!r) this.online = false; else if (!r.ok) why = r.why || r.error || "Try another.";
        }
        if (why) { this.send(a().at(13, 6).eol().k(12, why)); handle = ""; }
        else this.send(a().at(13, 6).eol());
      }
      const city = await this.ask(13, "City", 24);
      const joke = await this.ask(14, "What's the best sound a modem makes?", 30);
      this.send(a().at(15, 4).eol().k(8, "Transfer phrase: optional, 4+ characters. ENTER to skip."));
      const phrase = await this.ask(16, "Transfer phrase", 32, true);
      if (this.online) {
        this.send(a().at(18, 6).eol().k(8, "writing you into the user base..."));
        const r = await net("claim", { handle, city, phrase });
        if (r?.ok) {
          this.become(r.caller);
          Object.assign(this.io.profile, { joke, password: null }); this.io.save();
        } else if (r) {
          this.send(a().at(18, 6).eol().k(12, r.why || r.error || "The application was refused.").at(12, 1).raw("\x1b[J"));
          await sleep(1500);
          this.send(a().at(18, 6).eol());
          continue;
        } else this.online = false;
      }
      if (!this.online) {
        Object.assign(this.io.profile, { handle, city, joke, password: phrase });
        this.io.save();
        this.user = handle; this.guest = false;
      }
      this.send(a().at(18, 6).eol().k(10, `Welcome aboard, ${handle}. Validation noted. The sysop has your application.`));
      if (joke) this.send(a().at(19, 6).k(8, `Noted: "${joke.slice(0, 50)}". Bold choice.`));
      if (!this.online) this.send(a().at(20, 6).k(12, "Saved on this machine only until the message base is back."));
      await this.anyKey(21);
      return;
    }
  }

  async logon() {
    if (this.online) {
      const r = await net("logon", { speed: this.io.speed, guest: this.guest,board:this.io.entry.id, callSession:this.callSession,active:this.io.client.active?.()??true });
      if (!r || r.error) this.online = !!r;
      else if (r.banned) await this.suspended();
      else {this.billWaiting=r.billWaiting===true;this.clockExempt=r.exempt===true; if(r.caller)this.become(r.caller);this.callSession=r.callSession;
        this.io.speed=r.speed??9600;this.io.client.access?.({speed:this.io.speed,remainingSeconds:r.remainingSeconds??1800,level:this.level,exempt:this.clockExempt});
        if(!this.clockExempt&&r.remainingSeconds<=0&&!(await timeBank(this,true)))throw new Aborted("timeup");
        if(r.promotion)await promotionNotice(this,r.promotion);
      }
    }
    this.mailWaiting=(await net("mail",{guest:this.guest}))?.unread??0;
    this.startPresence();
  }

  // ── logon parade ───────────────────────────────────────────────
  async lastCallers() {
    const x = this.header(a(), "Last 10 callers", this.io.entry.number);
    x.at(5, 4).k(13, pad("#", 4)).k(13, pad("Handle", 20)).k(13, pad("Level", 20)).k(13, pad("Speed", 9)).k(13, "When");
    x.at(6, 4).k(5, "─".repeat(66));
    const r = this.online ? await net("callers") : null;
    const real: string[][] = (r?.callers ?? []).map((c: any) => [c.handle, c.level||"NEW USER", String(c.speed), timeAgo(c.created_at)]);
    const seeded = CALLERS.map((c, n) => [c[0], c[1], n % 3 ? "2400" : "9600", c[2]]);
    const list = [...real, ...seeded].slice(0, 10);
    list.forEach((c, n) => {
      const mine = n < real.length && !this.guest && c[0].toLowerCase() === this.user.toLowerCase();
      x.at(7 + n, 4).k(8, pad(String(n + 1).padStart(2, "0"), 4)).k(mine ? 15 : n < real.length ? 11 : 3, pad(c[0], 20)).k(3, pad(c[1], 20)).k(14, pad(c[2], 9)).k(9, c[3]);
    });
    if (!r?.callers) this.offlineNote(x, 18);
    this.send(x);
    await this.anyKey(20);
  }

  async news() {
    const x = this.header(a(), "News");
    box(x, 5, 4, 72, 13, 9, "11.17.93");
    const lines = [
      [15, "Archive drive is back on line!"], [7, "Static swapped the 120MB for a whole archive's worth of"],
      [7, "art packs, 1990-1996. Browse by year in the [F]ile areas."], [7, ""],
      [11, "Call our sister lines:"], [7, "  FULL BLOCK 555-0167 / LINE NOISE 555-0193 / STROBE 555-0177"], [7, ""],
      [13, "Doors: BASEMENT CRAWL and THE CORNER / fictional warez downstairs."],
    ] as [number, string][];
    if (this.filesSeen >= ATTIC_UNLOCK) lines.push([7, ""], [14, "A new board came online: The Attic, 555-0199."], [7, "1997 to the present. It's in your TELEWIRE phone book now."]);
    lines.forEach(([c, t], n) => x.at(6 + n, 7).k(c, t));
    this.send(x);
    await this.anyKey(19);
  }

  async oneliners() {
    this.setDoing("reading the oneliners");
    for (;;) {
      const r = this.online ? await net("oneliners") : null;
      const list: string[][] = r?.oneliners ? r.oneliners.map((o: any) => [o.handle+" / "+(o.level||"NEW USER"), o.body]) : ONELINERS;
      const x = this.header(a(), "Oneliners wall", r?.oneliners ? `latest ${list.length}` : "");
      list.slice(-15).forEach(([h, t], n) => { x.at(5 + n, 3).k(8, "░▒").k(n % 2 ? 13 : 11, pad(h, 29)); pipes(x, t.slice(0,45)); });
      if (!list.length) x.at(6, 6).k(8, "The wall is bare. Be the first.");
      const canPost = !!r?.oneliners && !this.guest;
      if (!r?.oneliners) this.offlineNote(x, 21);
      else if (this.guest) x.at(21, 4).k(8, "Guests can read the wall. Apply with NEW to write on it.");
      else x.at(21, 4).k(5, "[").k(15, "A").k(5, "]").k(13, "dd a oneliner").k(8, "   ·   colors: |01-|15   ·   any other key continues");
      this.send(x);
      const k = await this.key();
      this.io.clearOutput();
      if (canPost && k.ch !== null && String.fromCharCode(k.ch).toUpperCase() === "A") { await this.addOneliner(); continue; }
      return;
    }
  }

  async addOneliner() {
    const body = await this.ask(22, ">", 70);
    if (!body) return;
    const v = checkOneliner(body);
    let msg: [number, string];
    if (!v.ok) msg = [12, v.why];
    else {
      const r = await net("post", { body: v.value,board:this.io.entry.id });
      msg = !r ? [12, "The message base is offline. Your line fell on the floor."]
        : r.ok ? [10, "Scrawled on the wall."] : [12, r.why || r.error || "Rejected."];
    }
    this.send(a().at(23, 4).eol().k(msg[0], msg[1]));
    await this.io.drain(); await sleep(1400);
  }

  // ── main menu ──────────────────────────────────────────────────
  menuItems():[string,string][] {
    if(this.io.entry.id==='maple')return [['1','Picture of the Day'],['2','Club-approved shelf'],['3','Surprise me'],['4','Club bulletins'],['5','Your shelf'],['6','New to you'],['7','Search the club shelf'],['8','Artist credits'],['9','Goodbye'],['0','Your record'],['M','Mail'],['K','Time bank'],['P','Send a postcard']];
    if(this.io.entry.id==='c93')return [['L','List text files'],['R','Read pack / file'],['S','Search by handle / title'],['N','New to you'],['T','Tagged queue'],['F','Your shelf'],['B','Bulletins'],['C','Toggle color'],['A','All archive files'],['Q','Quit'],['V','Your record'],['M','Mail'],['K','Time bank'],['P','Send a postcard']];
    if(this.io.entry.id==='vault')return [['F','Groups / packs'],['I','Artist index A-Z'],['S','Search'],['T','Tagged slideshow'],['N','New to you'],['Y','Your shelf'],['B','Studio bulletins'],['C','Credits'],['G','Goodbye'],['V','Your record'],['M','Mail'],['K','Time bank'],['P','Send a postcard']];
    if(this.io.entry.id==='strobe')return [['J','Jukebox'],['A','Animations'],['R','Roulette'],['F','Archive'],['S','Search'],['T','Tagged queue'],['Y','Your shelf'],['B','Bulletins'],['C','Credits'],['G','Goodbye'],['V','Your record'],['M','Mail'],['K','Time bank'],['P','Send a postcard']];
    return [['F','File areas'],['Z','0-DAY ART'],['S','Search'],['Y','Your shelf'],['N','New scan'],['X','Warez'],['D','Doors'],['O','Oneliners'],['W',"Who's online"],['U','Last callers'],['B','This week / Top 10'],['P','Page sysop'],['C','Credits'],['G','Goodbye'],['V','Your record'],['M','Mail'],['K','Time bank'],['L','Send a postcard']];
  }
  private menuCallers = CALLERS.slice(0,3).map(c=>c[0]);
  private menuOneliner = ONELINERS[0][1];
  private menuFeatured = HOUSE_PACK;
  menuScreen(selected=0) {
    this.screenMode();
    if(!["attic","void"].includes(this.io.entry.id))return drawMenu(this.io.entry.id,this.config.name,this.menuItems(),{user:this.user,node:this.node,credits:this.creditsLeft,minutes:Math.ceil(this.io.timeLeftMs()/60000),callers:this.menuCallers,oneliner:this.menuOneliner,level:this.level,zeroDay:this.zeroDayCache?String(this.zeroDayCache.length):'checking',featured:this.menuFeatured},selected);
    const x=a().cls();shadeBar(x,79,this.sk.a&7);chromeText(x,3,4,this.io.entry.id==='attic'?'ATTIC':'VOID NODE',[15,this.sk.b,this.sk.a,this.sk.a,this.sk.c,this.sk.c&7],this.sk.a&7);box(x,8,3,75,11,this.sk.a&7);this.menuItems().forEach((_,i)=>x.bytes(menuSelection(this.io.entry.id,this.menuItems(),i,i===selected).build()));this.status(x,24);return x;
  }
  async mainMenu(): Promise<'bye'> {
    let selected=0;
    for(;;){
      await this.clockCheck();
      this.setDoing('at the main menu');
      if(this.io.entry.id==='crawl'){
        const [callers,lines,balance]=await Promise.all([net('callers'),net('oneliners'),this.guest?Promise.resolve(null):net('balance')]);
        if(callers?.callers?.length)this.menuCallers=callers.callers.slice(0,3).map((c:any)=>c.handle);
        if(lines?.oneliners?.length)this.menuOneliner=lines.oneliners[lines.oneliners.length-1].body;
        if(balance?.balance!=null)this.creditsLeft=balance.balance;
      }
      if(this.io.entry.id==='vault'){const packs=[...discovered.values()];if(packs.length)this.menuFeatured=packs[Math.floor(Date.now()/86400000)%packs.length].name;}
      this.send(this.menuScreen(selected));const items=this.menuItems();this.hint([...items.map(([c])=>hk(c)),...NAV,hk('?')]);
      let c='',frame=0;const started=Date.now(),reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
      for(;;){
        const k=this.io.entry.id==='strobe'&&!reduced&&Date.now()-started<6000?await this.io.keyTimeout(250):await this.key();
        if(!k){frame++;this.send(strobeMotion(frame));if(frame%2===0)this.send(menuSelection('strobe',items,selected,true,frame/2));const ticker=' GREETS / FULL BLOCK / LATCHKEY / TIN SAINTS / MIDNIGHT RELAY / ALL CALLERS / ';this.send(a().at(24,1).k(14,pad((ticker+ticker).slice(frame%ticker.length),79)));continue;}
        c=String.fromCharCode(k.ch??0).toUpperCase();
        if(this.config.style==='lightbar'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k.key)){
          this.send(menuSelection(this.io.entry.id,items,selected,false));const columns=this.io.entry.id==='vault'?6:this.io.entry.id==='crawl'?1:2;selected=(selected+(k.key==='ArrowUp'?-columns:k.key==='ArrowDown'?columns:k.key==='ArrowLeft'?-1:1)+items.length)%items.length;this.send(menuSelection(this.io.entry.id,items,selected,true));continue;
        }
        if(k.key==='Enter'&&this.config.style==='lightbar')c=items[selected][0];
        if(c==='?'&&this.config.style==='prompt'){const help=a().nl(2);items.forEach(([v,l],i)=>{if(i%2===0)help.nl();help.k(10,pad(`${v}  ${l}`,37));});help.nl(2).t('Command (?=help): ');this.send(help);continue;}
        if(items.some(([v])=>v===c)||c==='!')break;
      }
      this.io.clearOutput();
      if(this.io.entry.id==='maple'){if(c==='P')await composePostcard(this);else if(c==='K')await timeBank(this);else if(c==='M')await this.mail();else if(c==='V'||c==='0')await yourRecord(this);else if(c==='9'){if(await this.confirmBye())return 'bye';}else if(c==='1')await this.openFamily(pictureOfDay(new Date()));else if(c==='2')await this.familyList();else if(c==='3')await this.openFamily(FAMILY_SHELF[Math.floor(Math.random()*FAMILY_SHELF.length)]);else if(c==='4')await this.bulletins();else if(c==='5')await this.shelf();else if(c==='6')await this.newScan();else if(c==='7')await this.search();else if(c==='8')await this.credits();continue;}
      if(this.io.entry.id==='c93'){if(c==='P')await composePostcard(this);else if(c==='K')await timeBank(this);else if(c==='M')await this.mail();else if(c==='V')await yourRecord(this);else if(c==='Q'){if(await this.confirmBye())return 'bye';}else if(c==='L')await this.textList();else if(c==='R'){const path=await this.ask(22,'pack/file',70);await this.openPath(path);}else if(c==='S')await this.search();else if(c==='N')await this.newScan();else if(c==='T')await this.playTags();else if(c==='F')await this.shelf();else if(c==='B')await this.bulletins();else if(c==='C')this.colorBack=!this.colorBack;else if(c==='A')await this.yearList();continue;}
      switch(c){case 'K':await timeBank(this);break;case 'M':await this.mail();break;case 'V':await yourRecord(this);break;case 'F':await this.files();break;case 'Z':await this.zeroDay();break;case 'S':await this.search();break;case 'Y':await this.shelf();break;case 'N':await this.newScan();break;case 'T':await this.playTags();break;case 'I':await this.artistIndex();break;case 'J':await this.juke();break;case 'R':await this.roulette();break;case 'X':if(this.io.entry.id==='crawl')await this.warez();break;case 'A':await this.animations();break;case 'B':if(this.io.entry.id==='crawl')await sceneBulletin(this);else await this.bulletins();break;case 'O':await this.oneliners();break;case 'W':await this.whosOnline();break;case 'U':await this.lastCallers();break;case 'P':if(this.io.entry.id==='crawl')await this.pageSysop();else await composePostcard(this);break;case 'L':await composePostcard(this);break;case 'D':await this.doors();break;case 'C':await this.credits();break;case 'G':if(await this.confirmBye())return 'bye';break;case '!':await this.sysopConsole();break;}
    }
  }

  async bulletins() {
    const BULLETINS=this.config.bulletins;
    for (;;) {
      const x = this.header(a(), "Bulletins");
      BULLETINS.forEach((b, n) => x.at(6 + n * 2, 6).hot(String(n + 1), "  " + b.title, 15, 5, 11));
      x.at(6 + BULLETINS.length * 2, 6).hot(String(BULLETINS.length + 1), "  Top 10 downloads", 15, 5, 11);
      x.at(8 + BULLETINS.length * 2, 6).k(8, "Pick a number, or ESC to go back: ");
      this.send(x);
      const k = await this.key();
      if (k.key === "Escape" || k.key === "Enter") return;
      const n = k.ch !== null ? k.ch - 49 : -1;
      if (n === BULLETINS.length) { await this.topFiles(); continue; }
      const b = BULLETINS[n];
      if (!b) continue;
      const y = this.header(a(), `Bulletin #${n + 1}`);
      y.at(5, 4).k(15, b.title).at(6, 4).k(5, "═".repeat(b.title.length));
      b.body.forEach((l, i) => y.at(8 + i, 4).k(7, l));
      this.send(y);
      await this.anyKey(20);
    }
  }

  async topFiles() {
    const x = this.header(a(), "Top 10 downloads");
    x.at(5, 4).k(13, pad("#", 4)).k(13, pad("File", 18)).k(13, pad("Pack", 22)).k(13, "Callers");
    x.at(6, 4).k(5, "─".repeat(56));
    const r = this.online ? await net("top") : null;
    const top: any[] = r?.top ?? [];
    top.forEach((t, n) => x.at(7 + n, 4).k(8, pad(String(n + 1).padStart(2, "0"), 4)).k(11, pad(t.file, 18)).k(3, pad(String(t.pack).toUpperCase(), 22)).k(14, String(t.views)));
    if (!r) this.offlineNote(x, 18);
    else if (!top.length) x.at(8, 6).k(8, "Nobody has downloaded anything yet. Go on, be first.");
    else x.at(18, 4).k(8, "One count per caller per file. Pack names are what you type in F.");
    this.send(x);
    await this.anyKey(20);
  }

  /** Who's online: refreshes every 15 s while on screen, repainting only the rows that changed. */
  async whosOnline() {
    const x = this.header(a(), "Who's online");
    x.at(5, 4).k(13, pad("Node", 6)).k(13, pad("Caller", 18)).k(13, pad("Level", 16)).k(13, pad("Speed", 8)).k(13, "Doing");
    x.at(6, 4).k(5, "─".repeat(72));
    this.send(x);
    let prev: string[] = [];
    for (let first = true; ; first = false) {
      const r = this.online ? await this.beat("reading who's online") : null;
      const list: any[] = r?.online ?? [{ handle: this.guest ? null : this.user, city: this.io.profile.city, speed: this.io.speed, doing: "reading who's online", me: true }];
      const rows: Uint8Array[] = [];
      for (let n = 0; n < 8; n++) {
        const o = list[n];
        const y = a().at(7 + n, 4).k(15, pad(String(n + 1), 6));
        if (!o) y.k(8, pad("-", 18)).k(8, pad("", 16)).k(8, pad("", 8)).k(8, pad("waiting for caller...", 26));
        else y.k(o.me ? 15 : 11, pad(o.handle || "Guest", 18)).k(3, pad(o.level || "NEW USER", 16)).k(14, pad(String(o.speed), 8)).k(7, pad(String(o.doing).slice(0, 26), 26));
        rows.push(y.build());
      }
      const foot = a().at(17, 4).eol();
      if (!r) this.offlineNote(foot, 17);
      else if (!list.some((o) => !o.me)) foot.k(13, "Nobody else is on. Just you, the hum of the 486 and Static snoring.");
      else foot.k(8, `${list.length} caller${list.length > 1 ? "s" : ""} on line. Static's phone bill weeps.`);
      rows.push(foot.build());
      const key = rows.map((b) => String.fromCharCode(...b));
      const out = a();
      key.forEach((k, i) => { if (k !== prev[i]) out.bytes(rows[i]); });
      if (first) out.at(19, 1).k(8, "  ░▒▓").k(5, "[").k(15, " any key leaves · refreshes every 15 s ").k(5, "]").k(8, "▓▒░");
      this.send(out);
      prev = key;
      const k = await this.io.keyTimeout(15_000);
      if (k) { this.io.clearOutput(); return; }
    }
  }

  // ── sysop console (hidden: ! at the main menu) ─────────────────
  async sysopConsole() {
    const x = this.header(a(), "Sysop console");
    x.at(6, 6).k(8, "Authorized personnel only. That means Static.");
    this.send(x);
    const key = await this.ask(8, "Sysop key", 64, true);
    if (!key) return;
    const r = await net("sysop", { key, op: "auth" });
    const fail = (title: string, line: string) => {
      const y = a(); box(y, 11, 14, 52, 5, 12, title); y.at(13, 17).k(15, pad(line, 46)).raw("\x07"); this.send(y);
      return this.anyKey(18);
    };
    if (!r) return fail("OFFLINE", "The message base is offline.");
    if (r.disabled) return fail("CONSOLE DISABLED", "Console disabled. Static pulled the key switch.");
    if (!r.ok) return fail("ACCESS DENIED", r.status === 429 ? "Too many tries. The console is sulking." : "Wrong key. A dog growls in the basement.");
    const op = (o: string, arg = "") => net("sysop", { key, op: o, arg });
    for (;;) {
      const m = this.header(a(), "Sysop console", "node 0");
      const items: [string, string][] = [["1", " list oneliners"], ["2", " hide a oneliner"], ["3", " ban a handle"], ["4", " list reports"], ["5", " hide a file"], ["6", " unhide a file"], ["7", " counters, 14 days"], ["8"," wall posts"],["9"," hide wall post"],["0"," message reports"],["Q", "uit console"]];
      items.forEach(([k, l], n) => m.at(5 + n * 2, 8).hot(k, l, 15, 12, 14));
      m.at(22, 4).k(12, "Sysop").k(8, " ► ").k(14, "Command").k(5, ": ");
      this.send(m);
      const k = await this.key();
      this.io.clearOutput();
      const c = k.ch !== null ? String.fromCharCode(k.ch).toUpperCase() : k.key === "Escape" ? "Q" : "";
      if (c === "Q") return;
      if(c==="8"||c==="0"){const r=await op(c==="8"?"wall":"messageReports");const x=this.header(a(),c==="8"?"Wall posts":"Message reports");(r?.rows??[]).slice(0,15).forEach((v:any,i:number)=>x.at(5+i,4).k(7,pad(c==="8"?`#${v.id} ${v.handle} ${v.hidden?"HIDDEN":""} ${v.body.replace(/\n/g," / ")}`:`${v.kind} #${v.message_id}`,72)));this.send(x);await this.anyKey(22);continue;}
      if(c==="9"){const id=await this.ask(23,"Wall post #",10);await op("hideWall",id);continue;}
      const result = async (p: Promise<any>) => {
        const res = await p;
        this.send(a().at(23, 4).eol().k(res?.ok ? 10 : 12, res?.ok ? "Done." : "No such thing, or the base didn't answer."));
        await this.io.drain(); await sleep(1100);
      };
      if (c === "1" || c === "4") {
        const res = await op(c === "1" ? "oneliners" : "reports");
        const y = this.header(a(), c === "1" ? "Oneliners (all)" : "Reports");
        const why = ["", "offensive", "renders wrong", "takedown"];
        (res?.rows ?? []).forEach((o: any, n: number) => {
          if (c === "1") y.at(5 + n, 3).k(o.hidden ? 8 : 14, pad(`#${o.id}`, 7)).k(o.hidden ? 8 : 11, pad(o.handle, 17)).k(o.hidden ? 8 : 7, pad(o.body, 52));
          else y.at(5 + n, 3).k(11, pad(`${o.pack}/${o.file}`, 34)).k(12, pad(why[o.reason], 15)).k(3, pad(o.handle || "guest", 17)).k(8, timeAgo(o.created_at));
        });
        if (!res?.rows?.length) y.at(6, 6).k(8, "(nothing)");
        this.send(y); await this.anyKey(21);
      } else if (c === "2") { const id = await this.ask(23, "Oneliner #", 10); if (id) await result(op("hideOneliner", id.replace("#", ""))); }
      else if (c === "3") { const h = await this.ask(23, "Ban handle", 16); if (h) await result(op("ban", h)); }
      else if (c === "5" || c === "6") { const f = await this.ask(23, "pack/FILE", 70); if (f) await result(op(c === "5" ? "hide" : "unhide", f)); }
      else if (c === "7") {
        const res = await op("counters");
        const steps = ["landed", "powered_on", "dialed", "connected", "logged_in", "first_art", "third_art", "called_back"];
        const heads = ["land", "power", "dial", "conn", "login", "art1", "art3", "back"];
        const y = this.header(a(), "Daily counters", "last 14 days");
        y.at(5, 3).k(13, pad("day", 12)); heads.forEach((h) => y.k(13, rpad(h, 8)));
        y.at(6, 3).k(5, "─".repeat(76));
        for (let d = 13; d >= 0; d--) {
          const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
          const row = y.at(7 + (13 - d), 3).k(7, pad(day, 12));
          steps.forEach((st) => { const v = (res?.rows ?? []).find((r: any) => r.day === day && r.step === st)?.count ?? 0; row.k(v ? 15 : 8, rpad(String(v), 8)); });
        }
        this.send(y); await this.anyKey(22);
        const more = ["postcard_sent", "postcard_opened", "postcard_skipped", "postcard_replied", "postcard_entered", "tape_recorded", "bill_printed", "promoted"];
        const z = this.header(a(), "Daily counters", "sharing, 14 days");
        const sc = res?.secondCall ?? { created: 0, returned: 0 };
        z.at(4, 3).k(7, "Second-call rate: ").k(15, `${sc.returned} of ${sc.created} handles called back on a later UTC day`).k(14, sc.created ? `  ${Math.round((sc.returned / sc.created) * 100)}%` : "  -");
        z.at(5, 3).k(13, pad("day", 12)); ["sent", "opened", "skip", "reply", "enter", "tapes", "bills", "promo"].forEach((h) => z.k(13, rpad(h, 8)));
        z.at(6, 3).k(5, "─".repeat(76));
        for (let d = 13; d >= 0; d--) {
          const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
          const row = z.at(7 + (13 - d), 3).k(7, pad(day, 12));
          more.forEach((st) => { const v = (res?.rows ?? []).find((r: any) => r.day === day && r.step === st)?.count ?? 0; row.k(v ? 15 : 8, rpad(String(v), 8)); });
        }
        this.send(z); await this.anyKey(22);
      }
    }
  }

  async userList() {
    const x = this.header(a(), "User list");
    x.at(5, 4).k(13, pad("Handle", 22)).k(13, pad("From", 20)).k(13, "Level");
    x.at(6, 4).k(5, "─".repeat(56));
    const users = [[SYSOP, "in the basement", "255"], ...CALLERS.map((c) => [c[0], c[1], "20"])];
    if (!this.guest) users.push([this.user, this.io.profile.city || "parts unknown", "10"]);
    users.forEach((u, n) => x.at(7 + n, 4).k(n === 0 ? 14 : 11, pad(u[0], 22)).k(3, pad(u[1], 20)).k(7, u[2]));
    this.send(x);
    await this.anyKey(18);
  }

  private pages = 0;
  /** Static answers every fourth page, and always on the first page after 20 files. */
  async pageSysop() {
    const SYSOP=this.config.sysop;
    this.pages++;
    const p = this.io.profile;
    const after20 = this.filesSeen >= 20 && !p.chatAfter20;
    const answers = sysopAnswers(this.pages, this.filesSeen, !!p.chatAfter20);
    const x = this.header(a(), "Page sysop");
    x.at(6, 6).k(11, `Paging ${SYSOP}`);
    this.send(x);
    for (let i = 0; i < 5; i++) { this.send(a().k(15, " .").raw("\x07")); await this.io.drain(); await sleep(answers && i === 2 ? 300 : 500); if (answers && i === 2) break; }
    if (answers) {
      if (after20) { p.chatAfter20 = true; this.io.save(); }
      this.setDoing("chatting with the sysop");
      this.send(a().at(8, 6).k(14, "*** SYSOP BREAKING IN ***").raw("\x07"));
      await this.io.drain(); await sleep(900);
      if(this.io.entry.id!=="crawl"){this.send(a().at(10,6).k(this.sk.a,pad(`${SYSOP}: ${this.config.bulletins[1].body[0]}`,68)));await this.anyKey(20);return;}
      await sysopChat(this.io, (y) => this.send(y), (k) => this.hint(k), this.user, this.sk !== VOID_SKIN && !p.voidUnlocked);
      return;
    }
    const y = a();
    box(y, 9, 10, 60, 7, 13, "NO ANSWER");
    y.at(11, 13).k(15, `${SYSOP} is asleep in the basement, next to the modem.`);
    y.at(12, 13).k(7, "He set the chat flag to \"only for emergencies\" in 1992.");
    y.at(13, 13).k(7, "Try leaving a oneliner. Or paging again. And again.");
    this.send(y);
    await this.anyKey(18);
  }

  async doors() {
    this.setDoing("in a door: BASEMENT CRAWL");
    for(;;){this.send(this.header(a(),"Doors").at(6,6).k(15,"1 BASEMENT CRAWL").at(8,6).k(14,"2 THE CORNER").at(12,6).k(8,"ESC main menu"));const k=await this.key();this.io.clearOutput();if(k.key==="Escape")return;if(k.ch===49)await this.hushed(()=>doorMenu({io:this.io,send:y=>this.send(y),user:this.user,guest:this.guest,hint:h=>this.hint(h)}));if(k.ch===50)await this.hushed(()=>cornerDoor(this.io,this.guest,this.user));}
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
      [13, "(int10h.org), CC BY-SA 4.0; extra fonts: libansilove, BSD-2-Clause."],
      [13, "KPLAY music: libopenmpt (BSD license) via chiptune3 (MIT license)."],
      [7, ""],
      [7, "Board software, house pack DC-01, the machine and the modem: Dial-Up."],
      [7, "All brand names here are invented."],
      [7, ""],
      [14, "Takedown requests: sysop@ (placeholder)"],
      [7, ""],
      [8, `p.s. the NUP is ${VOID_NUP}. you didn't read that here.`],
    ];
    L.forEach(([c, t], n) => x.at(5 + n, 5).k(c, t));
    this.send(x);
    await this.anyKey(20);
  }

  async confirmBye() {
    this.send(a().nl().at(23, 4).eol().k(14, "Log off? ").k(5, "[").k(15, "Y").k(5, "/").k(15, "n").k(5, "]").k(7, " "));
    this.hint([hk("Y"), hk("N")]);
    const k = await this.key();
    return !(k.ch !== null && String.fromCharCode(k.ch).toLowerCase() === "n");
  }

  async goodbye() {
    if(!['attic','void'].includes(this.io.entry.id)){this.screenMode();this.send(goodbyeDesign(this.io.entry.id,this.config.name,this.user,this.config.quotes[Math.floor(Math.random()*this.config.quotes.length)]));await this.io.drain();await sleep(900);return;}
    const x = a().cls();
    const v = this.sk === VOID_SKIN;
    x.at(1, 1); shadeBar(x, 79, v ? 4 : 5);
    chromeText(x, 4, 6, "SEE YA", v ? [7, 7, 12, 12, 4, 4] : [15, 13, 13, 5, 5, 1], v ? 4 : 5);
    x.at(8, 6).k(8, "...the line is yours again");
    if (!v) stairwell(x, 3, 50, 13);
    else x.at(5, 50).k(4, "the void says nothing back.");
    x.at(11, 1); shadeBar(x, 79, v ? 8 : 1);
    x.at(13, 1).k(15, center(`Thanks for calling, ${this.user}.`, 79));
    const q = this.config.quotes[Math.floor(Math.random() * this.config.quotes.length)];
    x.at(15, 1).k(3, center(q.length > 77 ? q.slice(0, 77) : q, 79));
    x.at(18, 1).k(this.sk.c, center(v ? "VOID//NODE · 555-01?3 · forget this number" : `${this.config.name} · ${this.io.entry.number} · ${this.config.sysop} signs off`, 79)).at(20, 1).reset();
    this.send(x);
    await this.io.drain();
    await new Promise((r) => setTimeout(r, 900));
  }

  async timesUp() {
    this.io.clearOutput();this.io.client.overlay(null);this.screenMode();
    this.send(this.header(a(),'Until the next call').at(8,5).k(15,`${this.config.sysop}: thank you for sharing the line.`).at(11,5).k(14,'Your minutes return at 00:00 UTC. Time bank is K next call.'));
    await this.io.drain();
  }

  // ── file areas ─────────────────────────────────────────────────
  async files() {
    if(this.io.entry.id==='crawl'){this.send(this.header(a(),'File areas').at(6,5).k(15,'1 Archive / 2 THE WALL / 3 INNER CIRCLE').at(9,5).k(11,'WALL write: VALIDATED / INNER CIRCLE: ELITE'));this.hint(['1','2','3'].map(c=>({key:c,ch:c,label:c})));const k=await this.key();this.io.clearOutput();if(k.key==='Escape')return;if(k.ch===50){await wall(this);return;}if(k.ch===51){await innerCircle(this);return;}}

    this.setDoing("browsing the file areas");
    const mode = this.io.entry.mode;
    if (mode === "year1993") return this.textList();
    if(mode === "family")return this.familyList();
    if (mode === "groups") return this.groupList();
    if (mode === "void") return this.mostViewed();
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
      const [y0, y1] = this.io.entry.years;
      try { years = await getYears(y0, y1); } catch { failed = true; }
      const items = [
        { text: `${pad("HOUSE", 8)}${pad("DC-01 · the board's own pack", 44)}7 files`, color: 14 },
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
      if (r.index === 0) await this.packScreen({ name: HOUSE_PACK, year: 1994, groups: ["Dead Carrier house crew"] });
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
      const r = await this.lightbar({ row: 7, col: 3, width: 74, height: 14, items, index: idx, highlight: (i) => {
        const target = p.items[i - (p.page > 1 ? 1 : 0)]; if(target?.name) void getPack(target.name,target.groups).catch(()=>{});
      } });
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
      this.send(this.header(a(), "FULL BLOCK", "by group"));
      await this.loading("Opening the vault...");
      let p;
      try { p = await getGroups(page); } catch (e) { await this.errorScreen(String((e as Error).message)); return; }
      const items: { text: string; color: number; act?: string; name?: string }[] = [];
      if (page === 1) items.push({ text: `${pad("DEAD CARRIER", 40)}house pack`, color: 14, name: "__house" });
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
      if (it.name === "__house") { await this.packScreen({ name: HOUSE_PACK, year: 1994, groups: ["Dead Carrier house crew"] }); continue; }
      const name = it.name; if(!name)continue;
      const [y0, y1] = this.io.entry.years;
      await this.pagedPacks(`Group: ${name}`, `${y0}-${Math.min(y1, MAX_YEAR)}`, async () => {
        const all = await getGroupPacks(name, y0, y1);
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
    if(this.io.entry.id === "maple" && startFile && !familyAllowed(s.name,startFile)){await this.clubRefusal();return;}
    if(this.io.entry.id === "maple" && !FAMILY_SHELF.some(f=>f.pack===s.name)){await this.clubRefusal();return;}
    this.send(this.header(a(), `Pack ${s.name.toUpperCase()}`, String(s.year)));
    if (!packCached(s.name)) await this.loading("Retrieving pack listing...");
    let pack: PackInfo;
    try { pack = await getPack(s.name, s.groups); } catch (e) { await this.errorScreen(String((e as Error).message)); return; }
    if (!pack.groups.length) pack.groups = s.groups;
    if (!pack.groups.length && this.io.entry.id!=="maple") { // no group anywhere in the listing: try the SAUCE of the first art file, else omit
      for (const f of pack.files.filter((x) => x.viewable && !/\.(diz|nfo|txt)$/i.test(x.name)).slice(0, 2)) {
        try { const g = (parseSauce(await getFile(pack.name, f.name)).sauce?.group || "").trim(); if (g) { pack.groups = [g]; break; } } catch { /* skip */ }
      }
    }
    let diz: Uint8Array | null = null;
    if (pack.fileId && !startFile && this.io.entry.id!=="maple") { try { diz = parseSauce(await getFile(pack.name, pack.fileId)).body; } catch { diz = null; } }
    if(this.io.entry.id === "maple")pack={...pack,files:pack.files.filter(f=>familyAllowed(pack.name,f.name))};
    if(this.io.entry.id === "c93")pack.files.sort((a,b)=>Number(/\.(nfo|diz|asc|txt)$/i.test(b.name))-Number(/\.(nfo|diz|asc|txt)$/i.test(a.name)));
    const viewable = pack.files.filter((f) => f.viewable);
    if (startFile) {
      if (isHousePack(pack.name)) startFile = houseName(startFile);
      const i = viewable.findIndex((f) => f.name.toLowerCase() === (startFile ?? "").toLowerCase());
      if (i >= 0) await this.viewer(pack, viewable, i);
    }
    let idx = 0, showAll = false;
    for (;;) {
      const listed = pack.files.filter(f => showAll || f.viewable || MUSIC.test(f.name));
      const hidden = pack.files.length - pack.files.filter(f=>f.viewable||MUSIC.test(f.name)).length;
      const x = this.header(a(), `Pack ${pack.name.toUpperCase()}`, pack.groups.length ? `${pack.year} · ${pack.groups.join(", ")}` : String(pack.year));
      // FILE_ID.DIZ, drawn line by line into the top area
      if (diz) {
        const lines = splitLines(diz).slice(0, 10);
        lines.forEach((l, n) => { x.at(4 + n, 3).reset(); x.bytes(l); x.reset(); });
      } else x.at(5, 4).k(8, "(no FILE_ID.DIZ in this pack)");
      x.at(14, 3).k(13, pad("File", 16) + pad("SAUCE title / Artist", 36) + rpad("Size", 10)).at(15, 3).k(5, "─".repeat(64));
      x.at(23,4).eol().k(8,`${hidden} files this terminal can't show (H to ${showAll?"hide":"list"} them)`);
      x.at(13,3).k(8,"SPC tag / V queue / L show / Q scan / H others / D save / P play / ESC");
      this.status(x);
      this.send(x);
      const label = (f:PackFile) => `${pad(f.name,16)}${pad(f.title || fileTitle(pack.name,f.name) || f.artists.join(", ") || "—",36)}${rpad(String(f.size ?? "?"),10)}`;
      const items = listed.map((f) => ({
        text: `${this.tagged.has(`${pack.name}/${f.name}`)?"*":" "}${label(f)}`,
        color: MUSIC.test(f.name) ? 10 : /\.(ans|ice|bin|xb)$/i.test(f.name) ? 11 : 3, dim: !f.viewable && !MUSIC.test(f.name),
      }));
      const r = await this.lightbar({ row: 16, col: 2, width: 68, height: 6, items, index: idx, hotkeys: "DPVQLH ", tag: (i)=>{const f=listed[i],path=`${pack.name}/${f.name}`;if(f.viewable){if(this.tagged.has(path))this.tagged.delete(path);else this.tagged.add(path);}return `${this.tagged.has(path)?"*":" "}${label(f)}`;}, refresh: () => {
        let changed = false; listed.forEach((f,i)=>{const t=`${this.tagged.has(`${pack.name}/${f.name}`)?"*":" "}${label(f)}`; if(items[i].text!==t){items[i].text=t;changed=true;}});return changed;
      } });
      if (!r) return;
      idx = r.index;
      if(r.key === "H") { showAll=!showAll; idx=0; continue; }
      if(r.key === " "){const path=`${pack.name}/${listed[idx].name}`;if(this.tagged.has(path))this.tagged.delete(path);else this.tagged.add(path);continue;}
      if(r.key === "V"){await this.playTags();continue;}
      if(r.key === "L"){await this.autoQueue(pack,viewable);continue;}
      if(r.key === "Q"){await this.quickScan(pack,viewable);continue;}
      const f = listed[r.index];
      const music = MUSIC.test(f.name);
      if (r.key === "D" || r.key === "P" || (music && !r.key)) {
        const play = music && r.key !== "D";
        if (r.key === "P" && !music) { this.send(a().at(23, 4).eol().k(12, `${f.name}: that's not music. Try D to download it.`)); await sleep(1200); continue; }
        const bytes = await this.hushed(() => this.download(pack, f));
        if (bytes && play) { await this.io.drain(); await this.io.client.kplay(f.name, bytes); }
        continue;
      }
      if (!f.viewable) {
        this.send(a().at(23, 4).eol().k(12, `${f.name}: not viewable on this terminal.`));
        await new Promise((res) => setTimeout(res, 900));
        continue;
      }
      await this.viewer(pack, viewable, viewable.indexOf(f));
    }
  }

  // ── viewer ─────────────────────────────────────────────────────
  /** ZMODEM-style receive, metered by the modem: the transfer screen plus invisible filler bytes add up to the file size. */
  async download(pack: PackInfo, f: PackFile): Promise<Uint8Array | null> {
    const io = this.io;
    this.setDoing(`downloading ${f.name}`.slice(0, 40));
    if(!fileCached(pack.name,f.name)) this.send(a().at(23, 4).eol().k(8, "░▒▓ ").k(11, `retrieving ${f.name}...`).k(8, " ▓▒░"));
    let bytes: Uint8Array;
    try { bytes = await getFile(pack.name, f.name); } catch (e) { await this.errorScreen(`${f.name}: ${(e as Error).message}`); return null; }
    await io.drain();
    const total = bytes.length, cps = Math.round(io.speed / 10);
    const x = a();
    box(x, 7, 12, 56, 11, 11, "TELEWIRE · ZMODEM RECEIVE");
    x.at(9, 15).k(7, "File     ").k(15, pad(f.name, 20)).k(7, "  from ").k(14, pack.name.slice(0, 14));
    x.at(10, 15).k(7, "Bytes    ").k(15, `${total}`);
    x.at(11, 15).k(7, "Rate     ").k(15, `${cps} cps`).k(8, ` at ${io.speed} bps`);
    x.at(15, 15).k(8, "ENTER finish now · ESC abort");
    this.send(x);
    this.hint([{ label: "ENTER finish", key: "Enter" }, { label: "ESC abort", key: "Escape" }]);
    const STEPS = 40, bar = 46;
    const filler = "\x1b[?0h"; // a mode-set the terminal ignores: line time without ink
    let aborted = false, done = 0;
    for (let i = 1; i <= STEPS && !aborted; i++) {
      const target = Math.round((total * i) / STEPS);
      const chunk = target - done; done = target;
      const left = Math.ceil((total - done) / cps);
      const prog = a().at(12, 15).k(7, "Received ").k(15, rpad(String(done), 8)).k(7, "  left ").k(15, `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`)
        .at(13, 15).k(11, "█".repeat(Math.round((bar * i) / STEPS))).k(8, "░".repeat(bar - Math.round((bar * i) / STEPS)));
      const padLen = Math.max(0, chunk - prog.length);
      this.send(a().raw(filler.repeat(Math.floor(padLen / filler.length))));
      this.send(prog);
      for (;;) {
        const k = await io.keyOrDrain();
        if (k === null) break;
        if (k.key === "Escape") { aborted = true; io.clearOutput(); break; }
        if (k.key === "Enter") io.flush();
      }
      if (!aborted) io.client.disk();
    }
    if (aborted) {
      this.send(a().at(15, 15).eol().k(12, "Transfer aborted by receiver.").at(15, 67).k(11, "║"));
      await io.drain(); await sleep(1200); return null;
    }
    const saved = await io.client.saveDownload({ name: f.name, bytes, pack: pack.name, year: pack.year, file: f.name, artists: f.artists, groups: pack.groups });
    const y = a().at(15, 15).eol().k(10, saved ? `Saved as C:\\DOWNLOAD\\${saved.name}` : "Disk error: file not saved.").at(15, 67).k(11, "║");
    if (saved?.dropped.length) y.at(16, 15).k(8, pad(`disk full: deleted ${saved.dropped.join(", ")}`, 50));
    this.send(y.raw("\x07"));
    await io.drain(); await sleep(1300);
    return bytes;
  }

  async viewer(pack: PackInfo, files: PackFile[], idx: number, opts: { animation?: boolean; local?: Uint8Array } = {}) {
    if(this.io.entry.id==="maple"){files=files.filter(f=>familyAllowed(pack.name,f.name));idx=Math.min(idx,files.length-1);if(!files.length)return;}
    const io = this.io;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const clearNotice = () => { clearTimeout(noticeTimer); noticeTimer=undefined; };
    const restore = () => { clearNotice(); io.client.overlay(null); this.screenMode(); };
    for (;;) {
      const f = files[idx];
      if(!opts.local && !fileCached(pack.name,f.name)) this.send(a().cls().at(12, 1).k(8, center(`░▒▓ retrieving ${f.name} from the stacks ▓▒░`, 79)));
      let bytes: Uint8Array;
      try { bytes = opts.local ?? await getFile(pack.name, f.name); } catch (e) { restore(); await this.errorScreen(`${f.name}: ${(e as Error).message}`); return; }
      await io.drain();
      let prep: Prepared;
      try { prep = prepareArt(f.name, bytes); } catch (e) { restore(); await this.errorScreen(`${f.name}: ${(e as Error).message}`); return; }
      const art = { sauce: prep.sauce };
      if(!opts.local)void net("index",{rows:[{pack:pack.name,file:f.name,year:pack.year,title:prep.sauce?.title||f.title||"",artist:prep.sauce?.author||f.artists.join(", "),groups:prep.sauce?.group||pack.groups.join(", ")}]});
      const mode = prep.mode, stream = prep.stream;
      await io.client.artOpen(true);
      this.screenMode(mode);
      io.client.markTop();
      io.send(stream);
      if(!opts.local) for(const n of [idx-1,idx+1]) { const neighbor=files[n]; if(neighbor) prefetchFile(pack.name,neighbor.name); }
      const seen = `${pack.name}/${f.name}`;
      const before = maxSpeed(io.profile);
      if (!opts.local && !io.profile.filesSeen.includes(seen)) { if(this.guest)this.creditsLeft++;io.profile.filesSeen.push(seen); io.save(); }
      if (!opts.local) { this.setDoing(`viewing ${f.name}`.slice(0, 40)); artViewed(); }
      if (this.online && !opts.local) void net("view", { pack: pack.name, file: f.name,guest:this.guest,board:this.io.entry.id }).then((r) => { if (r?.files != null) { io.profile.serverFiles = r.files; io.save(); } });
      const url = typeof location !== "undefined" ? `${(import.meta.env.DEV && (globalThis as { __filmOrigin?: string }).__filmOrigin) || location.origin}/dial/${this.io.entry.number}/${pack.year}/${pack.name}/${encodeURIComponent(f.name)}` : "";
      const unlocked = maxSpeed(io.profile) !== before ? maxSpeed(io.profile) : 0;
      let finished = false, info = false;
      const viewHints = (done: boolean) => this.hint([
        ...(done ? [{ label: "↑", key: "ArrowUp" }, { label: "↓", key: "ArrowDown" }, { label: "PGUP", key: "PageUp" }, { label: "PGDN", key: "PageDown" }]
          : [{ label: "SPACE pause", key: " " }, ...(opts.animation ? [] : [{ label: "ENTER finish", key: "Enter" }])]),
        hk("F","F favorite"),hk("E","E rate 1-5"),...(opts.local?[]:[hk("C","C card")]),...(this.io.entry.id==="c93"?[hk("O","O color")]:[]),hk("I", "I info"), ...(idx > 0 ? [hk("P", "P prev")] : []), ...(idx < files.length - 1 ? [hk("N", "N next")] : []), ...(opts.local ? [] : [hk("R", "R report")]), { label: "ESC back", key: "Escape" },
      ]);
      viewHints(false);
      const showInfo = () => io.client.overlay(info ? infoPanel(pack, f, art.sauce, bytes.length, mode, unlocked, url) : null);
      let next = 0;
      while (!next) {
        const k = finished ? await this.key() : await io.keyOrDrain();
        if (k === null) { finished = true;await this.clockCheck();viewHints(true);continue; }
        const c = k.ch !== null ? String.fromCharCode(k.ch).toUpperCase() : "";
        if (k.key === " " && !finished) { if (io.isPaused()) io.resume(); else io.pause(); continue; }
        if (k.key === "Enter") { io.flush(); continue; }
        if (k.key === "Escape") {
          if (info) { info = false; showInfo(); continue; }
          io.clearOutput(); io.resume(); restore(); io.client.artOpen(false); return;
        }
        if(c === "F" && !opts.local){
          clearNotice();
          const title=prep.sauce?.title||f.title||fileTitle(pack.name,f.name)||'';
          const favored=this.guest?toggleGuestFavorite(pack.name,f.name,title):(await net("favorite",{pack:pack.name,file:f.name}))?.favorite;
          io.client.overlay(a().at(25,1).c(14,0).t(pad(typeof favored==='boolean'?(favored?'Added to your shelf':'Removed from your shelf'):'Shelf unavailable. Try again later.',79)).build());
          noticeTimer=setTimeout(()=>{noticeTimer=undefined;showInfo();},2000);
          continue;
        }
        if(c === "C" && !opts.local){clearNotice();io.clearOutput();io.resume();io.client.overlay(null);await composePostcard(this,{pack:pack.name,file:f.name,year:pack.year,artist:(prep.sauce?.author||f.artists[0]||"unknown artist").trim()});this.screenMode(mode);io.send(stream);finished=false;viewHints(false);continue;}
        if(c === "O" && this.io.entry.id === "c93"){this.colorBack=!this.colorBack;io.clearOutput();this.screenMode(mode);io.send(stream);finished=false;continue;}
        if(c === "E" && !opts.local){const k=await io.key();const rating=(k.ch??0)-48;if(rating>=1&&rating<=5)await net("rating",{pack:pack.name,file:f.name,rating,board:this.io.entry.id,guest:this.guest});continue;}
        if (c === "I") { clearNotice(); info = !info; showInfo(); continue; }
        if (c === "R" && !opts.local) { await this.report(pack, f); showInfo(); viewHints(finished); continue; }
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
      clearNotice(); io.clearOutput(); io.resume(); io.client.overlay(null); io.client.artOpen(false);
      idx += next;
    }
  }

  async report(pack: PackInfo, f: PackFile) {
    const io = this.io;
    const panel = (lines: [number, string][]) => {
      const x = a(); box(x, 8, 20, 42, lines.length + 4, 12, "REPORT THIS FILE");
      lines.forEach(([c, t], n) => x.at(10 + n, 24).k(c, pad(t, 35)));
      io.client.overlay(x.build());
    };
    panel([[15, f.name], [7, ""], [11, "1  offensive"], [11, "2  renders wrong"], [11, "3  I made this, please remove"], [8, "ESC  never mind"]]);
    this.hint([hk("1"), hk("2"), hk("3"), { label: "ESC", key: "Escape" }]);
    const k = await io.key();
    const n = k.ch !== null ? k.ch - 48 : 0;
    if (n >= 1 && n <= 3) {
      const r = await net("report", { pack: pack.name, file: f.name, reason: n });
      panel([[15, f.name], [7, ""], r?.ok ? [10, "Filed. Static reads these on Sundays."] : r?.status === 429 ? [12, "You've filed plenty. Try later."] : [12, "Message base offline. Not filed."], [7, ""], [7, ""], [7, ""]]);
      await sleep(1500);
    }
    io.client.overlay(null);
  }

  async openPath(path:string){const [pack,file]=path.split('/');if(!pack||!file)return;if(this.io.entry.id==='maple'&&!familyAllowed(pack,file)){await this.clubRefusal();return;}try{const p=await getPack(pack);const i=p.files.filter(f=>f.viewable).findIndex(f=>f.name.toLowerCase()===file.toLowerCase());if(i<0){await this.errorScreen('That file is not viewable.');return;}await this.viewer(p,p.files.filter(f=>f.viewable),i);}catch(e){await this.errorScreen(String(e));}}
  async openFamily(piece:typeof FAMILY_SHELF[number]|undefined){if(!piece)return;await this.openPath(`${piece.pack}/${piece.file}`);}
  async familyList(){for(;;){this.send(this.header(a(),'Club-approved shelf').at(23,3).k(8,'ENTER picture / ESC return'));const r=await this.lightbar({row:5,col:3,width:74,height:16,items:FAMILY_SHELF.map(f=>({text:`${pad(f.file,18)}${pad(f.pack,18)}${f.artist}`,color:9}))});if(!r)return;await this.openFamily(FAMILY_SHELF[r.index]);}}
  async fileResults(title:string,rows:{pack:string;file:string;year?:number;title?:string;artist?:string}[]){if(this.io.entry.id==='maple')rows=rows.filter(r=>familyAllowed(r.pack,r.file));if(!rows.length){this.send(this.header(a(),title).at(7,5).k(8,'No results found.'));await this.anyKey(22);return;}for(;;){this.send(this.header(a(),title).at(4,3).k(this.sk.a,`   ${pad('File',13)}${pad('Pack',12)}${pad('Title',28)}Artist`).at(23,3).k(8,'ENTER view / SPACE tag / V queue / ESC return'));const r=await this.lightbar({row:5,col:3,width:74,height:16,items:rows.map(f=>({text:`${this.tagged.has(`${f.pack}/${f.file}`)?'*':' '} ${pad(f.file,13)}${pad(f.pack,12)}${pad(f.title||'(untitled)',28)}${pad(f.artist||'unknown',18)}`,color:this.sk.a})),hotkeys:' V'});if(!r)return;if(r.key==='V'){await this.playTags();continue;}const f=rows[r.index];if(!f)continue;if(r.key===' '){const id=`${f.pack}/${f.file}`;if(this.tagged.has(id))this.tagged.delete(id);else this.tagged.add(id);continue;}await this.openPath(`${f.pack}/${f.file}`);}}
  async shelf(){const rows=this.guest?guestShelf():(await net('shelf'))?.rows??[];const enriched=[];for(const row of rows){if(this.io.entry.id==='maple'&&!familyAllowed(row.pack,row.file))continue;let title=row.title||fileTitle(row.pack,row.file)||'',artist=row.artist||'';if(!title||!artist){try{const p=await getPack(row.pack),pf=p.files.find(f=>f.name===row.file);title=title||pf?.title||'';artist=artist||pf?.artists?.join(', ')||'';if(!title||!artist){const sc=prepareArt(row.file,await getFile(row.pack,row.file)).sauce;title=title||sc?.title||'';artist=artist||sc?.author||'';}}catch{}}enriched.push({...row,title,artist});}await this.fileResults('Your shelf',enriched);}
  async search(){const query=await this.ask(22,'Artist / group / title',60);if(!query)return;this.send(this.header(a(),'Searching',query));let rows:any[]=[];if(this.io.entry.id==='maple')rows=FAMILY_SHELF.filter(f=>`${f.file} ${f.artist} ${f.pack}`.toLowerCase().includes(query.toLowerCase()));else{const r=await net('search',{query});rows=r?.rows??[];for(const p of discovered.values())for(const f of p.files)if(f.viewable&&`${f.name} ${f.title} ${f.artists.join(' ')} ${p.groups.join(' ')}`.toLowerCase().includes(query.toLowerCase())&&!rows.some(r=>r.pack===p.name&&r.file===f.name))rows.push({pack:p.name,file:f.name,title:f.title,artist:f.artists.join(', ')});if(!rows.length){try{const gs=await getGroupPacks(query,1990,1996);if(gs.length){await this.pagedPacks(`Group: ${query}`,'archive credits',async()=>({items:gs,page:1,pages:1,total:gs.length}));return;}const d=await directLookup('artist',query);const packs=d.results?.packs??{};for(const [year,names]of Object.entries(packs))for(const name of names as string[]){const p=await getPack(name);for(const f of p.files.filter(f=>f.artists.some(a=>a.toLowerCase().includes(query.toLowerCase()))))rows.push({pack:name,file:f.name,year:+year,artist:f.artists.join(', ')});if(rows.length>=80)break;}}catch{}}}await this.fileResults(`Search: ${query}`,rows);}
  async artistIndex(){const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';this.send(this.header(a(),'Artist index A-Z').at(5,4).k(11,letters.split('').join(' ')).at(8,4).k(8,'Pick an initial / ESC return'));const k=await this.key();if(k.key==='Escape')return;const letter=String.fromCharCode(k.ch??0).toUpperCase();if(!letters.includes(letter))return;const artists=[...new Set([...discovered.values()].flatMap(p=>p.files.flatMap(f=>f.artists)))].filter(a=>a.toUpperCase().startsWith(letter)).sort();this.send(this.header(a(),`Artists: ${letter}`).at(23,3).k(8,'ENTER search / ESC return'));const r=await this.lightbar({row:5,col:3,width:74,height:16,items:artists.map(a=>({text:a,color:11}))});if(r){const result=await net('search',{query:artists[r.index]});await this.fileResults(artists[r.index],result?.rows??[]);}}
  async newScan(){await callScan(this); }
  async textList(){const packs=[...discovered.values()];if(!packs.length){try{packs.push(await getPack('ensiart'));}catch{}}const rows=packs.flatMap(p=>p.files.filter(f=>/\.(nfo|diz|asc|txt)$/i.test(f.name)).map(f=>({pack:p.name,file:f.name,title:f.title,artist:f.artists.join(', ')})));await this.fileResults('text first',rows);}
  private zeroDayCache: PackSummary[] | null=null;
  setScenePacks(packs:ScenePack[]){this.zeroDayCache=packs;}
  async openScenePack(p:ScenePack){await this.packScreen(p);}
  async zeroDay(){await sceneBulletin(this,true);}


  async roulette(){try{const years=await getYears();const y=years[Math.floor(Math.random()*years.length)];const list=await getYearPacks(y.year,1);const chosen=list.items[Math.floor(Math.random()*list.items.length)];const pack=await getPack(chosen.name);const fs=pack.files.filter(f=>f.viewable);if(fs.length)await this.viewer(pack,fs,Math.floor(Math.random()*fs.length));}catch(e){await this.errorScreen(String(e));}}
  async autoQueue(pack:PackInfo,files:PackFile[]){for(let i=0;i<files.length;i++){const f=files[i];if(this.io.entry.id==='maple'&&!familyAllowed(pack.name,f.name))continue;try{const prep=prepareArt(f.name,await getFile(pack.name,f.name));this.screenMode(prep.mode);this.io.client.markTop();this.send(prep.stream);if(files[i+1])prefetchFile(pack.name,files[i+1].name);const k=await this.io.keyOrDrain();if(k){this.io.clearOutput();break;}await this.io.drain();if(await this.io.keyTimeout(ACCESS[this.level].hold))break;}catch{}}this.io.clearOutput();this.screenMode();}
  async playTags(){for(const path of orderedTags(this.tagged)){const [name,file]=path.split('/');try{const p=await getPack(name),f=p.files.find(f=>f.name===file&&f.viewable);if(!f||(this.io.entry.id==='maple'&&!familyAllowed(name,file)))continue;const prep=prepareArt(f.name,await getFile(name,file));this.screenMode(prep.mode);this.send(prep.stream);for(;;){const k=await this.io.keyOrDrain();if(k){this.io.clearOutput();this.screenMode();return;}if(k===null)break;}if(await this.io.keyTimeout(ACCESS[this.level].hold))break;}catch{}}this.io.clearOutput();this.screenMode();}
  async quickScan(pack:PackInfo,files:PackFile[]){
    files=files.filter(f=>f.viewable&&(this.io.entry.id!=='maple'||familyAllowed(pack.name,f.name)));
    if(!files.length)return;
    let count=0;
    this.hint([hk(' ','SPACE pause'),{label:'ESC back',key:'Escape'}]);
    const control=async()=>{for(;;){const k=await this.io.keyOrDrain();if(k===null)return true;if(k.key==='Escape')return false;if(k.key===' '){if(this.io.isPaused())this.io.resume();else this.io.pause();}}};
    try{for(const f of files){
      if(!f.viewable||(this.io.entry.id==='maple'&&!familyAllowed(pack.name,f.name)))continue;
      let prep:Prepared;try{prep=prepareArt(f.name,await getFile(pack.name,f.name));}catch{continue;}
      if(!count){this.io.client.setMode({...prep.mode,cols:80,rows:25});this.send(a().cls());}
      const start=count===0?1:count===1?11:16;
      if(count>1)this.send(a().at(25,1).nl(count===2?5:10));
      const from=firstVisibleRow(prep);
      this.send(scanPreview(prep,start,from));
      this.send(scanCaption(f.name,prep.sauce?.title||f.title||'',prep.sauce?.author||f.artists.join(', '),this.sk.a,start+8,from));
      count++;
      if(!await control())return;
      const wait=await this.io.keyTimeout(1000);
      if(wait?.key==='Escape')return;
      if(wait?.key===' '){this.io.pause();for(;;){const k=await this.io.key();if(k.key==='Escape')return;if(k.key===' '){this.io.resume();break;}}}
    }
    // Keep the finished contact sheet until the caller returns.
    if(count)for(;;){const k=await this.io.key();if(k.key==='Escape')break;}
    }finally{this.io.clearOutput();this.io.resume();this.screenMode();}
  }
  async juke(){for(;;){this.send(this.header(a(),'STROBE / Jukebox').at(23,3).k(8,'ENTER play / SPACE queue / V play queue / ESC back'));const r=await this.lightbar({row:5,col:3,width:74,height:16,items:jukebox.map(t=>({text:`${pad(t.file,20)}${pad(t.pack,20)}${t.artist}`,color:13})),hotkeys:' V'});if(!r)return;if(r.key===' '){this.musicQueue.push(jukebox[r.index]);continue;}const tunes=r.key==='V'?this.musicQueue.splice(0):[jukebox[r.index]];for(const t of tunes){if(!t)continue;try{const bytes=await getFile(t.pack,t.file);await this.io.drain();await this.io.client.kplay(t.file,bytes);}catch(e){await this.errorScreen(String(e));}}}}
  async warez(){for(;;){this.send(this.header(a(),'WAREZ / FICTION',`${this.creditsLeft} credits`).at(5,5).k(12,'1 0-DAY   2 UTILS   3 GAMEZ   4 CRACKTROS   5 COURIER.LOG').at(8,5).k(8,'Art +1 / rating +1 / oneliner +2 / doors +5 / THE CORNER +8').at(10,5).k(7,'All releases original fiction. No commercial software.').at(22,5).k(8,'ESC return'));const k=await this.key();this.io.clearOutput();if(k.key==='Escape')return;const n=(k.ch??0)-49;if(n===4){const calls=this.guest?1:this.caller?.calls??1;for(let i=0;i<Math.min(calls,8);i++){const x=this.header(a(),`COURIER.LOG / ${i+1} of 8`);x.at(6,5).k(7,wrapCourier(COURIER_LOGS[i])[0]??'').at(7,5).k(7,wrapCourier(COURIER_LOGS[i])[1]??'');this.send(x);await this.anyKey(20);}continue;}const area=['0-DAY','UTILS','GAMEZ','CRACKTROS'][n];if(!area)continue;let at=0;for(;;){const releases=RELEASES.filter(r=>r.area===area);this.send(this.header(a(),`WAREZ / ${area}`).at(23,3).k(8,'ENTER NFO / D download / ESC directories'));const r=await this.lightbar({row:5,col:3,width:74,height:16,index:at,items:releases.map(r=>({text:`${pad(r.id,10)}${pad(r.title,28)}${pad(r.group,18)}${r.cost} credits`,color:12})),hotkeys:'D'});if(!r)break;at=r.index;const rel=releases[r.index];if(r.key!=='D'){for(let page=0;page<Math.ceil(nfoLines(rel.id).length/23);page++){this.send(nfoPage(rel.id,page));await this.io.drain();const key=await this.key();this.io.clearOutput();if(key.key==='Escape')break;}continue;}if(this.guest){if(this.creditsLeft<rel.cost){this.send(a().at(23,3).eol().k(12,'Static: no ratio, no disk. View some art.'));await this.key();continue;}this.creditsLeft-=rel.cost;}else{const buy=await net('warezBuy',{id:rel.id});if(!buy?.ok){this.send(a().at(23,3).eol().k(12,buy?.why??'Ledger offline. Transfer refused.'));await this.key();continue;}this.creditsLeft=buy.balance;}this.send(a().cls());box(a(),7,12,56,11,11);this.send(a().at(8,14).k(11,'TELEWIRE / ZMODEM RECEIVE').at(11,14).k(15,`${rel.id}.ZIP`).at(13,14).k(11,'████████████████████████████████████').at(16,14).k(8,'ENTER completes / ESC aborts'));await this.io.drain();const key=await this.io.key();if(key.key==='Escape')continue;const bytes=nfoBytes(rel.id);if(rel.runnable)await this.io.client.saveDownload({name:`C:\\WAREZ\\${rel.id}\\${rel.id}.EXE`,bytes:new TextEncoder().encode('KESTREL-RUN:'+rel.id),pack:'fiction',year:1993,file:'PROGRAM',artists:[rel.group],groups:[rel.group]});await this.io.client.saveDownload({name:`C:\\WAREZ\\${rel.id}\\${rel.id}.NFO`,bytes,pack:'fiction',year:1993,file:'NFO',artists:[rel.group],groups:[rel.group]});await this.io.client.saveDownload({name:`C:\\WAREZ\\${rel.id}\\FILE_ID.DIZ`,bytes:dizBytes(rel.id),pack:'fiction',year:1993,file:'DIZ',artists:[rel.group],groups:[rel.group]});this.send(a().at(18,3).k(10,`Unpacked C:\\WAREZ\\${rel.id} / ${rel.runnable?'RUN '+rel.id:'NFO collector release'}`));await this.anyKey(20);}}}

  // ── VOID//NODE ─────────────────────────────────────────────────
  async voidGate() {
    this.send(this.logo(a()).at(17, 1));
    for (let t = 0; t < 3; t++) {
      this.send(a().at(18, 4).eol().k(8, "new-user password").k(4, ": "));
      const pw = await this.input(20, { mask: true, fg: 12 });
      if (pw.toUpperCase() === VOID_NUP) {
        const p = this.io.profile;
        const first = !p.voidUnlocked;
        p.voidUnlocked = true; this.io.save();
        this.send(a().at(20, 4).eol().k(7, "accepted.").k(8, first ? " your modem has been told about 28800. it will not forget." : " welcome back to nowhere."));
        await this.io.drain(); await sleep(1600);
        return;
      }
      this.send(a().at(20, 4).eol().k(4, "no.").raw("\x07"));
    }
    this.send(a().at(20, 4).eol().k(8, "the line goes quiet."));
    await this.io.drain(); await sleep(900);
    throw new Aborted("hangup");
  }

  /** VOID//NODE's file area: the same archive, sorted by what callers actually opened. */
  async mostViewed() {
    let idx = 0;
    for (;;) {
      this.send(this.header(a(), "Most viewed", "every board, all callers"));
      await this.loading("asking the other nodes what they looked at...");
      const r = this.online ? await net("top", { limit: 40 }) : null;
      const top: { pack: string; file: string; views: number }[] = r?.top ?? [];
      const items = [
        ...top.map((t) => ({ text: `${pad(t.file, 16)}${pad(String(t.pack).toUpperCase(), 30)}${rpad(String(t.views), 6)} callers`, color: 12 })),
        { text: "browse the whole archive by year instead", color: 7 },
      ];
      const x = a().at(5, 4).k(7, pad("File", 16) + pad("Pack", 30) + rpad("Seen by", 14)).at(6, 4).k(8, "─".repeat(70));
      if (!r) this.offlineNote(x, 21); else if (!top.length) x.at(21, 4).k(8, "nobody has opened anything yet. strange.");
      x.at(23, 4).eol().k(8, "ENTER open · ESC main menu");
      this.status(x);
      this.send(x);
      const pick = await this.lightbar({ row: 7, col: 3, width: 74, height: 13, items, index: idx });
      if (!pick) return;
      idx = pick.index;
      if (pick.index === top.length) { await this.yearList(); continue; }
      const t = top[pick.index];
      let pack: PackInfo;
      try { pack = await getPack(t.pack); } catch (e) { await this.errorScreen(String((e as Error).message)); continue; }
      const files = pack.files.filter((f) => f.viewable);
      const i = files.findIndex((f) => f.name === t.file);
      if (i >= 0) await this.viewer(pack, files, i);
    }
  }

  // ── animations ─────────────────────────────────────────────────
  /** Ansimations: cursor-movement art whose modem speed is the frame rate, so nothing is fast-forwarded by default. */
  async animations() {
    this.setDoing("watching ansimations");
    let idx = 0;
    const pack = await getPack(HOUSE_PACK);
    const files = pack.files.filter((f) => HOUSE_ANIMATIONS.includes(f.name));
    for (;;) {
      const x = this.header(a(), "Animations", "ansimations");
      [
        [15, "These pieces move. They are drawn with cursor moves, so your modem"],
        [15, "speed is the frame rate: slower lines, slower films."],
        [8, "They play out in full. (ENTER still works if you're impatient.)"],
      ].forEach(([c, t], n) => x.at(5 + n, 5).k(c as number, t as string));
      x.at(9, 4).k(this.sk.b, pad("File", 16) + pad("Title", 34) + rpad(`@${this.io.speed}`, 10)).at(10, 4).k(5, "─".repeat(62));
      x.at(22, 4).k(8, "Archive ansimations are not tagged as such upstream; only the house ones are listed.");
      this.status(x);
      this.send(x);
      const items = files.map((f) => ({ text: `${pad(f.name, 16)}${pad(f.name === "SPINNER.ANS" ? "Connecting spinner" : "Window rain", 34)}${rpad(this.estimate(f.size), 9)}`, color: 11 }));
      const r = await this.lightbar({ row: 11, col: 3, width: 66, height: 8, items, index: idx });
      if (!r) return;
      idx = r.index;
      await this.viewer(pack, files, r.index, { animation: true });
    }
  }

  async run(): Promise<void> {
    try {
      if (this.io.deepLink) return await this.runDeepLink(this.io.deepLink);
      if (this.io.postcardEntry) { const pe = this.io.postcardEntry; return await this.hushed(() => this.runPostcardEntry(pe)); }
      if (this.io.entry.mode === "void") await this.voidGate();
      await this.login();
      await this.logon();
      if(this.io.entry.id==='crawl')await sceneBulletin(this);
      await this.newScan();
      if(this.billWaiting){this.send(this.header(a(),"Mail from TRI-COUNTY BELLWIRE BILLING").at(8,5).k(15,"Last month's telephone statement is waiting. B reads / ENTER menu"));this.hint([{key:"B",ch:"B",label:"BILL"},{key:"Enter",label:"MENU"}]);const k=await this.key();this.clearPending();if(k.ch===66||k.ch===98)await this.bills(true);}
      if(this.mailWaiting){this.send(this.header(a(),"Mail waiting").at(8,5).k(this.sk.a,`${this.mailWaiting} private notes waiting. M reads / ENTER menu`));this.hint([{key:"M",ch:"M",label:"MAIL"},{key:"Enter",label:"MENU"}]);const k=await this.key();this.io.clearOutput();if(String.fromCharCode(k.ch??0).toUpperCase()==="M")await this.mail();}
      
      await this.mainMenu();
      await this.goodbye();
    } catch (e) {
      if (e instanceof Aborted && e.reason === "timeup") { await this.timesUp(); return; }
      throw e;
    } finally { this.stopPresence(); }
  }

  /** Arrived from a postcard: logged straight in as GUEST, then reply or browse the enclosed pack. */
  async runPostcardEntry(pe: NonNullable<HostIO["postcardEntry"]>) {
    this.send(this.logo(a()).at(19, 8).k(15, "login: ").k(14, "GUEST").at(20, 8).k(7, "Postcard delivery: express guest login..."));
    await this.io.drain(); await sleep(900);
    this.guest = true; this.user = "Guest";
    await this.logon();
    if (pe.mode === "reply") await composePostcard(this, null, pe.replyTo);
    else if (pe.pack) await this.packScreen({ name: pe.pack, year: pe.year ?? 1994, groups: [] }, pe.file);
    await this.mainMenu();
    await this.goodbye();
  }

  async runDeepLink(dl: DeepLink) {
    const p = this.io.profile;
    const hello = await net("hello");
    this.online = !!hello && !hello.error;
    if (hello?.caller && !hello.caller.banned) this.become(hello.caller);
    else if (!this.online && p.handle) { this.user = p.handle; this.guest = false; }
    await this.logon();
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



function infoPanel(pack: PackInfo, f: PackFile, s: Sauce | null, size: number, mode: TermMode, unlocked: number, url: string) {
  const x = a();
  const W = 70, R = 4, C = 6, V = W - 14;
  box(x, R, C, W, 17, 11, "FILE INFO");
  const row = (n: number, label: string, val: string, vc = 15) => x.at(R + 1 + n, C + 3).k(3, pad(label, 9)).k(vc, pad(val || "—", V));
  row(1, "Title", s?.title || f.name);
  row(2, "Artist", s?.author || f.artists.join(", "));
  row(3, "Group", s?.group || pack.groups.join(", "));
  row(4, "Pack", pack.name.toUpperCase());
  row(5, "Year", String(pack.year) + (s?.date ? `  (${sauceDate(s.date)})` : ""));
  row(6, "Font", `${mode.font ? `embedded 8x${mode.font.height}` : s?.tInfoS || "IBM VGA"}${mode.palette ? " · own palette" : ""} · ${mode.ninePixel ? "9px" : "8px"}${mode.ice ? " · iCE" : ""}`);
  row(7, "Size", `${size} bytes · ${mode.cols} cols${s ? "" : " · no SAUCE"}`);
  row(8, "File", f.name, 7);
  row(9, "Phone #", url.slice(0, V), 14);
  if (url.length > V) row(10, "", url.slice(V, V * 2), 14);
  if (unlocked) x.at(R + 12, C + 3).k(10, pad(`Your modem can now do ${unlocked}! (TELEWIRE: S)`, W - 6));
  x.at(R + 14, C + 3).k(8, "SPC pause · ENTER finish · N/P next/prev · R report · ESC");
  return x.build();
}

/** VIEW.COM: the board's viewer, run locally on a downloaded file (instant, no modem, no message base). */
export async function localView(io: HostIO, f: { name: string; bytes: Uint8Array; pack: string; year: number; artists: string[]; groups: string[] }) {
  const b = new Board(io);
  b.online = false;
  const pack: PackInfo = { name: f.pack, year: f.year, groups: f.groups, files: [], fileId: null };
  const pf: PackFile = { name: f.name, artists: f.artists, size: f.bytes.length, viewable: true };
  await b.viewer(pack, [pf], 0, { local: f.bytes });
}

export async function runBoard(io: HostIO) {
  await new Board(io).run();
}
