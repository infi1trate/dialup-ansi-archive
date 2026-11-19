// ANSI.SYS-subset terminal emulator: CP437 cell buffer with scrollback.
// Cell = uint16: low byte CP437 char, high byte VGA attribute
// (bits 0-3 fg, 4-6 bg, 7 blink — or bright background in iCE mode).

export interface TermMode { cols: number; rows?: number; ice: boolean; ninePixel: boolean; palette?: Uint32Array | null; font?: { bytes: Uint8Array; height: number } | null }
export interface TermStats { bytes: number; sequences: number; unknown: number; unknownList: string[]; linesScrolled: number }

const BLANK = 0x0720;
/** ANSI SGR color order -> VGA palette index (the mapping is its own inverse). */
export const ANSI_VGA = [0, 4, 2, 6, 1, 5, 3, 7];
const SCROLLBACK = 2400;

function xterm256(i: number): number {
  const V = [[0,0,0],[170,0,0],[0,170,0],[170,85,0],[0,0,170],[170,0,170],[0,170,170],[170,170,170],[85,85,85],[255,85,85],[85,255,85],[255,255,85],[85,85,255],[255,85,255],[85,255,255],[255,255,255]];
  let r: number, g: number, b: number;
  if (i < 16) [r, g, b] = V[Math.max(0, i)];
  else if (i < 232) { const n = i - 16, l = [0, 95, 135, 175, 215, 255]; r = l[Math.floor(n / 36)]; g = l[Math.floor(n / 6) % 6]; b = l[n % 6]; }
  else { r = g = b = 8 + (Math.min(i, 255) - 232) * 10; }
  return (1 << 24) | (r << 16) | (g << 8) | b;
}

export class Terminal {
  cols = 80;
  rows = 25;
  ice = false;
  ninePixel = true;
  lines: Uint16Array[] = [];
  x = 0;
  y = 0;
  savedX = 0;
  savedY = 0;
  cursorVisible = true;
  /** Lines scrolled up from the live screen (0 = live view). */
  viewOffset = 0;
  version = 0;
  stopped = false;
  stats: TermStats = { bytes: 0, sequences: 0, unknown: 0, unknownList: [], linesScrolled: 0 };
  onBell: () => void = () => {};
  /** Optional overlay drawn on top (e.g. TELEWIRE's local info panel). */
  overlay: Terminal | null = null;
  mask: Uint8Array | null = null;
  /** Per-line 24-bit overrides (PabloDraw ESC[0;R;G;Bt / ESC[1;R;G;Bt): [fg0,bg0,fg1,bg1...] as 0xRRGGBB|1<<24, 0 = palette. */
  ext: (Uint32Array | null)[] = [];
  /** Optional per-file palette (XBin) as ABGR u32 x16, and font (XBin) bytes with its glyph height. */
  palette: Uint32Array | null = null;
  font: { bytes: Uint8Array; height: number } | null = null;
  private tfg = 0; private tbg = 0;

  private fg = 7; private bg = 0; private bold = false; private blink = false;
  private reverse = false; private conceal = false;
  private state = 0; // 0 normal, 1 ESC, 2 CSI
  private params = "";

  constructor(mode?: Partial<TermMode>, opts?: { masked?: boolean }) {
    if (opts?.masked) this.mask = new Uint8Array(80 * 25);
    this.setMode({ cols: 80, ice: false, ninePixel: true, ...mode });
  }

  setMode(m: Partial<TermMode>) {
    const cols = Math.max(40, Math.min(m.cols ?? this.cols, 320));
    const rows = m.rows ?? (m.font?.height === 8 ? 50 : cols > 80 ? Math.round((25 * cols) / 80) : 25);
    const colsChanged = cols !== this.cols || rows !== this.rows || this.lines.length === 0;
    this.cols = cols;
    this.rows = rows;
    if (m.ice !== undefined) this.ice = m.ice;
    if (m.ninePixel !== undefined) this.ninePixel = m.ninePixel;
    this.palette = m.palette ?? null; // per-file palette/font last only as long as the file
    this.font = m.font ?? null;
    if (colsChanged) this.reset();
    this.version++;
  }

  reset() {
    this.lines = [];
    for (let i = 0; i < this.rows; i++) this.lines.push(this.blankLine());
    this.ext = this.lines.map(() => null);
    this.tfg = this.tbg = 0;
    this.x = this.y = this.savedX = this.savedY = 0;
    this.fg = 7; this.bg = 0; this.bold = this.blink = this.reverse = this.conceal = false;
    this.state = 0; this.params = ""; this.stopped = false; this.viewOffset = 0; this.cursorVisible = true;
    this.stats = { bytes: 0, sequences: 0, unknown: 0, unknownList: [], linesScrolled: 0 };
    this.mask?.fill(0);
    this.version++;
  }

  /** Start of the live screen inside `lines`. */
  get top() { return this.lines.length - this.rows; }
  get scrollbackLines() { return this.top; }

  scrollView(delta: number) {
    this.viewOffset = Math.max(0, Math.min(this.top, this.viewOffset + delta));
    this.version++;
  }
  scrollViewTo(offset: number) { this.viewOffset = 0; this.scrollView(offset); }

  cell(row: number, col: number) { return this.lines[this.top + row][col]; }

  private blankLine(attr = BLANK) { const l = new Uint16Array(this.cols); l.fill(attr); return l; }

  private attr() {
    let f = this.fg + (this.bold ? 8 : 0);
    let b = this.bg;
    if (this.reverse) { const t = f & 7; f = b | (f & 8); b = t; }
    if (this.conceal) f = b;
    return (f & 15) | ((b & 7) << 4) | (this.blink ? 0x80 : 0);
  }

  private lineFeed() {
    if (this.y < this.rows - 1) { this.y++; return; }
    this.lines.push(this.blankLine()); this.ext.push(null);
    if (this.lines.length > this.rows + SCROLLBACK) { this.lines.shift(); this.ext.shift(); }
    else if (this.viewOffset > 0) this.viewOffset++;
    this.stats.linesScrolled++;
  }

  private put(ch: number) {
    const line = this.lines[this.top + this.y];
    line[this.x] = ch | (this.attr() << 8);
    const li = this.top + this.y;
    if (this.tfg || this.tbg || this.ext[li]) {
      const e = this.ext[li] ?? (this.ext[li] = new Uint32Array(this.cols * 2));
      e[this.x * 2] = this.tfg; e[this.x * 2 + 1] = this.tbg;
    }
    if (this.mask) this.mask[this.y * 80 + this.x] = 1;
    this.x++;
    if (this.x >= this.cols) { this.x = 0; this.lineFeed(); }
  }

  feed(bytes: Uint8Array) {
    if (this.stopped) return;
    this.stats.bytes += bytes.length;
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if (c === 0x1b && this.state !== 0) { this.unknown("interrupted sequence"); this.state = 1; continue; }
      if (this.state === 0) {
        switch (c) {
          case 0x1b: this.state = 1; break;
          case 0x0d: this.x = 0; break;
          case 0x0a: this.lineFeed(); break;
          case 0x09: { this.x = Math.min(this.cols - 1, (this.x + 8) & ~7); break; }
          case 0x08: if (this.x > 0) this.x--; break;
          case 0x07: this.onBell(); break;
          case 0x1a: this.stopped = true; this.version++; return;
          default: this.put(c);
        }
      } else if (this.state === 1) {
        if (c === 0x5b) { this.state = 2; this.params = ""; }
        else { this.state = 0; this.unknown("ESC " + String.fromCharCode(c)); }
      } else {
        if ((c >= 0x30 && c <= 0x3f)) { this.params += String.fromCharCode(c); if (this.params.length > 32) { this.state = 0; this.unknown("long CSI"); } }
        else if (c >= 0x40 && c <= 0x7e) { this.state = 0; this.csi(String.fromCharCode(c)); }
        else if (c >= 0x20 && c <= 0x2f) { this.params += String.fromCharCode(c); }
        else { this.state = 0; this.unknown("bad CSI byte " + c); }
      }
    }
    this.version++;
  }

  private unknown(s: string) {
    this.stats.unknown++;
    if (this.stats.unknownList.length < 20 && !this.stats.unknownList.includes(s)) this.stats.unknownList.push(s);
  }

  private csi(f: string) {
    this.stats.sequences++;
    const p = this.params;
    const priv = /^[?=<>]/.test(p);
    const nums = (priv ? p.slice(1) : p).split(";").map((v) => (v === "" ? NaN : parseInt(v, 10)));
    const n = (i: number, d = 1) => (Number.isFinite(nums[i]) && nums[i] > 0 ? nums[i] : d);
    if (priv) {
      if (p === "?25" && (f === "h" || f === "l")) { this.cursorVisible = f === "h"; return; }
      if (p === "?33" && (f === "h" || f === "l")) { this.ice = f === "h"; this.version++; return; } // PabloDraw iCE
      if (f === "h" || f === "l") return; // ?7 wrap, =3h/=7h video modes: harmless on a fixed 80x25 terminal
      this.unknown(`CSI ${p}${f}`); return;
    }
    switch (f) {
      case "A": this.y = Math.max(0, this.y - n(0)); break;
      case "B": this.y = Math.min(this.rows - 1, this.y + n(0)); break;
      case "C": this.x = Math.min(this.cols - 1, this.x + n(0)); break;
      case "D": this.x = Math.max(0, this.x - n(0)); break;
      case "H": case "f":
        this.y = Math.min(this.rows - 1, n(0) - 1); this.x = Math.min(this.cols - 1, n(1) - 1); break;
      case "J": {
        const mode = Number.isFinite(nums[0]) ? nums[0] : 0;
        const blank = 0x20 | ((this.attr() & 0x70 | 0x07) << 8);
        const t = this.top;
        if (mode === 2) {
          for (let r = 0; r < this.rows; r++) { this.lines[t + r].fill(blank); this.ext[t + r] = null; }
          this.x = 0; this.y = 0; this.mask?.fill(0);
        } else if (mode === 0) {
          this.lines[t + this.y].fill(blank, this.x);
          for (let r = this.y + 1; r < this.rows; r++) this.lines[t + r].fill(blank);
        } else if (mode === 1) {
          this.lines[t + this.y].fill(blank, 0, this.x + 1);
          for (let r = 0; r < this.y; r++) this.lines[t + r].fill(blank);
        }
        break;
      }
      case "K": {
        const mode = Number.isFinite(nums[0]) ? nums[0] : 0;
        const blank = 0x20 | ((this.attr() & 0x70 | 0x07) << 8);
        const line = this.lines[this.top + this.y];
        if (mode === 0) line.fill(blank, this.x); else if (mode === 1) line.fill(blank, 0, this.x + 1); else line.fill(blank);
        if (this.mask) for (let c = this.x; c < 80; c++) this.mask[this.y * 80 + c] = mode === 0 ? 1 : this.mask[this.y * 80 + c];
        break;
      }
      case "m": {
        const list = nums.length ? nums : [0];
        for (let li = 0; li < list.length; li++) {
          const v = Number.isFinite(list[li]) ? list[li] : 0;
          if (v === 38 || v === 48) { // xterm extended color
            let rgb = 0;
            if (list[li + 1] === 2) { rgb = (1 << 24) | ((list[li + 2] & 255) << 16) | ((list[li + 3] & 255) << 8) | (list[li + 4] & 255); li += 4; }
            else if (list[li + 1] === 5) { rgb = xterm256(list[li + 2] | 0); li += 2; }
            else { this.unknown(`SGR ${v}`); continue; }
            if (v === 38) this.tfg = rgb; else this.tbg = rgb;
            continue;
          }
          if (v === 0) { this.fg = 7; this.bg = 0; this.bold = this.blink = this.reverse = this.conceal = false; this.tfg = this.tbg = 0; }
          else if (v === 1) this.bold = true;
          else if (v === 5 || v === 6) this.blink = true;
          else if (v === 7) this.reverse = true;
          else if (v === 8) this.conceal = true;
          else if (v === 21 || v === 22) this.bold = false;
          else if (v === 25) this.blink = false;
          else if (v === 2 || v === 3 || v === 4 || v === 23 || v === 24) { /* faint/italic/underline: no such thing in VGA text mode */ }
          else if (v === 27) this.reverse = false;
          else if (v === 28) this.conceal = false;
          else if (v >= 30 && v <= 37) { this.fg = ANSI_VGA[v - 30]; this.tfg = 0; }
          else if (v >= 90 && v <= 97) { this.fg = ANSI_VGA[v - 90]; this.bold = true; this.tfg = 0; }
          else if (v >= 100 && v <= 107) { this.bg = ANSI_VGA[v - 100]; this.tbg = 0; }
          else if (v === 39) this.fg = 7;
          else if (v >= 40 && v <= 47) { this.bg = ANSI_VGA[v - 40]; this.tbg = 0; }
          else if (v === 49) this.bg = 0;
          else this.unknown(`SGR ${v}`);
        }
        break;
      }
      case "t": { // PabloDraw 24-bit: ESC[0;R;G;Bt background, ESC[1;R;G;Bt foreground
        if (nums.length !== 4 || !nums.every(Number.isFinite)) { this.unknown(`CSI ${p}t`); break; }
        const rgb = (1 << 24) | ((nums[1] & 255) << 16) | ((nums[2] & 255) << 8) | (nums[3] & 255);
        if (nums[0] === 0) this.tbg = rgb; else if (nums[0] === 1) this.tfg = rgb; else this.unknown(`CSI ${p}t`);
        break;
      }
      case "M": { // Delete lines (ANSI music-era files also use this cursor operation).
        const at = this.top + this.y, count = Math.min(n(0), this.rows-this.y);
        this.lines.splice(at,count); this.ext.splice(at,count);
        for(let i=0;i<count;i++){this.lines.push(this.blankLine());this.ext.push(null);} break;
      }
      case "n": break; // device status report: nobody to answer on a one-way stream
      case "s": this.savedX = this.x; this.savedY = this.y; break;
      case "u": this.x = this.savedX; this.y = this.savedY; break;
      case "h": case "l": break; // mode set/reset (e.g. ESC[=7h) is harmless here
      default: this.unknown(`CSI ${p}${f}`);
    }
  }
}
