# DeadCarrier

Build "Dial-Up": an immersive, authentic early-1990s BBS in the browser that serves the ANSI art scene's archive. Desktop-first, keyboard-driven. THIS FIRST PASS builds the engine and the complete call loop on a bare CRT monitor. The basement room, full sound design and multi-user features come in later messages, so structure the code for them. Work through the whole spec; do not stop to ask questions, make sensible choices and note them.

Everything is client-rendered canvas/WebGL. Guard all canvas, WebGL, audio and localStorage code so it only runs in the browser.

## NON-NEGOTIABLE RULES
1. Never show art as an image. Art files are raw bytes streamed into OUR OWN terminal emulator at modem speed.
2. Nothing appears on the CRT that a 1992 PC could not draw: 80x25 text mode, CP437, 16 colors. No HTML/shadcn UI, no modern fonts, no tooltips over the screen. Every BIOS, DOS and BBS screen is CP437/ANSI content drawn by the terminal.
3. The keyboard runs the computer. The mouse only touches physical objects (power switch, knobs).
4. Every wait is skippable. Enter finishes a streaming piece instantly; Esc or Space skips boot and dialing.
5. Artist, group, pack and year are one keypress away on every piece (I = info).
6. All brand names are invented. No real BIOS, DOS, modem or software brands or logos.

## ARCHITECTURE (separate modules, these contracts)
- `src/term`: ANSI parser + cell buffer + font atlas. API: `feed(bytes: Uint8Array)`, `reset()`, `setMode({cols, ice, ninePixel})`, scrollback access.
- `src/modem`: byte scheduler. The host calls `write(bytes)`; the modem releases bytes to `term.feed` at the current line speed. Bytes per second = bps / 10. Fractional accumulator per animation frame with slight burstiness. `flush()` = deliver everything now. `pause()/resume()`.
- `src/bbs`: a VIRTUAL HOST. The board is async code that only ever writes bytes to the modem and reads keystrokes back. It never touches the screen directly. Typed characters are echoed by the host through the modem (remote echo).
- `src/crt`: WebGL2 post-process of the terminal framebuffer.
- `src/machine`: state machine: off -> boot -> dos -> comm -> dialing -> handshake -> session -> hangup.
- `src/audio`: for now an event bus only. Emit named events: powerOn, powerOff, keyDown, keyUp, beep, diskSeek, floppySeek, offHook, dialDigit(digit), ring, busy, handshakeStart(bps), connect(bps), hangup, byteFlow(rate). Implement only the PC-speaker beep now (square wave ~880 Hz, 150 ms) for POST and for byte 0x07.
- `src/data`: archive access (below).
- Expose a `screenAverageColor` signal (average RGB of the terminal framebuffer, updated ~10 times a second) for the room lighting later.

## TERMINAL
- Cell = CP437 byte, fg 0-15, bg 0-15, blink bit. 80 cols x 25 visible rows plus scrollback of at least 2000 rows.
- Parser: state machine for the ANSI.SYS subset: CSI A/B/C/D (cursor moves), H and f (position), J (2J clears and homes), K (clear to end of line), m (SGR: 0 reset, 1 bold = bright fg, 5 blink, 7 reverse, 8 conceal, 30-37, 40-47), s/u (save/restore cursor), CR, LF, TAB, BS, BEL (0x07 -> beep event), 0x1A = stop. Wrap at the last column exactly like ANSI.SYS. Ignore unknown sequences but count them (expose stats).
- iCE colors mode: SGR 5 sets bright background instead of blinking.
- Font: the real IBM VGA 8x16 CP437 bitmap font, rendered from a pixel-exact bitmap atlas with NO smoothing. Get the glyph bitmaps from the `pcface` npm package or from the "Ultimate Oldschool PC Font Pack" by VileR (int10h.org, CC BY-SA 4.0: credit it). Verify box-drawing (0xB3-0xDA) and block/shade glyphs (0xB0-0xB2, 0xDB-0xDF) are pixel-exact and join seamlessly.
- 9-pixel mode (default): each cell is 9px wide; the 9th column repeats the 8th for glyphs 0xC0-0xDF and is blank otherwise. Native framebuffer 720x400, displayed stretched to 4:3. 8-pixel mode: 640x400.
- Palette: the standard 16 VGA text colors (color 6 is brown #AA5500).
- Blink ~2 Hz; block cursor blinking faster.
- SAUCE: read the last 128 bytes; if they start with "SAUCE" parse title(35) author(20) group(20) date(8) ... TInfo1 = width, TInfo2 = lines, TFlags bit0 = iCE, bits1-2 letter spacing (01 = 8px, 10 = 9px), TInfoS = font name. Stream only the bytes before the 0x1A EOF marker. Apply flags per file; no SAUCE = 80 cols, 9px, blink.
- Files wider than 80 columns: set cols to the SAUCE width and scale the picture down to fit.

## MODEM
- Speeds: 2400, 9600, 14400, 28800. New callers start at 9600. Unlock 14400 after viewing 5 files, 28800 after 15. 2400 is an optional "hard mode". Persist in localStorage. Speed is chosen in the comm program's modem setup screen.
- Everything the board sends goes through the modem at line speed, menus included.

## CRT
- WebGL2 shader over the terminal framebuffer: gentle barrel curvature, scanlines, soft bloom, phosphor persistence, vignette, faint noise, rounded tube corners. Text MUST stay crisp and readable at 1x and 2x device pixel ratio. Legibility beats effect.
- Power-on: bright horizontal line blooms open, then warm-up fade. Power-off: picture collapses to a lingering dot.
- Fallback to plain 2D canvas if WebGL2 is unavailable. Respect prefers-reduced-motion (no flicker/wobble).
- Layout for this pass: black page, a centered beige 4:3 CRT monitor drawn in code (bezel, a power button with LED, brand plate "KESTREL VGA"), filling most of the viewport. Keep the monitor a self-contained component with a known screen rect; a full room scene will be placed around it later.

## THE CALL, START TO FINISH
1. Page loads dark and silent, monitor off, power LED dim. Clicking the power button boots (this click also unlocks audio).
2. BOOT: "Kestrel Systems BIOS v1.04", 486DX-33, memory count ticking to 4096K OK, drive detection, one beep. About 5 s first time, 2 s for returning visitors, skippable.
3. DOS: "Kestrel DOS 5.0". CONFIG/AUTOEXEC lines scroll, then `C:\>`. AUTOEXEC launches the comm program after 2 s unless a key is pressed. A tiny fake DOS works if the user types: DIR, CLS, VER, DATE, TIME, TYPE, CD, HELP, MEM, DIAL (starts comm program), plus a couple of easter eggs. Unknown input: "Bad command or file name".
4. COMM PROGRAM: invented "TELEWIRE v2.1", full-screen text UI with a dialing directory (name, number, speed, last call). Entries: "The Crawlspace BBS" 555-0142 (whole archive, 1990-1996); "Group Vault" 555-0167 (same board skin, browse by group first); "Class of '93" 555-0193 (1993 only). Arrows + Enter dials. S = modem setup (speed).
5. DIAL: terminal shows `ATZ` / `OK` / `ATDT 555-0142`, emits offHook, dialDigit, ring events with realistic timing. On the first call of a session there is a 20% chance of BUSY followed by an automatic redial countdown; never busy twice in a row.
6. CONNECT: emit handshakeStart, wait ~4 s (skippable), print `CONNECT 9600`, then the board takes over.
7. LOGIN: board logo streams in, then handle + password, or NEW, or GUEST. New-user form: handle, city, one joke question. Stored in localStorage only; tell the user on that screen not to use a real password.
8. LOGON PARADE: last callers (seeded fictional list plus the user), news bulletin, oneliners wall (static seed for now), each ending "press any key".
9. MAIN MENU hotkeys: [F]iles, [B]ulletins, [O]neliners, [W]ho's online, [U]ser list, [P]age sysop (sysop never answers; funny message), [D]oors ("sysop is still installing them"), [C]redits, [G]oodbye. Show handle, node number and time left (60 minutes per call; at zero the board kicks you with a "time's up" screen).
10. FILE AREAS: Year -> Pack list (paged, with group names) -> Pack screen showing FILE_ID.DIZ and a lightbar file list (name, size, artist, estimated transfer time at current speed) -> Viewer. Lightbar with arrow keys and Enter, PgUp/PgDn paging, Esc goes back. "Group Vault" starts from a group list instead of years.
11. VIEWER: screen clears, art streams at line speed and the screen scrolls as rows arrive, like a real terminal. Keys: Space pause/resume; Enter finish instantly; arrows/PgUp/PgDn/Home/End scroll after it finishes; N/P next/previous file; I info panel (title, artist, group, pack, year, font, size) drawn as a text-mode box; Esc back.
12. GOODBYE: logoff screen with a random quote, `NO CARRIER`, back to the dialing directory. Powering off at any time also works.

## BOARD SCREENS
All board screens are ANSI byte streams sent through the modem. Author them in code with a small helper that emits SGR color codes and CP437 box/block/shade characters. Make them look like real early-90s BBS menus: big block-letter logos built from half blocks and shade gradients, double-line boxes, colored hotkey brackets, plenty of cyan/magenta/blue on black. Board identity: "THE CRAWLSPACE BBS", sysop "Static", tagline "Running on a 486 under the stairs since 1991". Viewable types this pass: .ANS .ASC .ICE .DIZ .NFO .TXT (and .BIN as 160-column char/attribute pairs if straightforward). List other files dimmed as "not viewable on this terminal".

## DATA
- Source: the Sixteen Colors archive API at https://api.16colo.rs/ (v1). Endpoints: `/v1/year/` (counts per year), `/v1/year/:year` (packs in a year, with groups), `/v1/pack/:name` (pack details and per-file data including a raw file URL; `sauce=true` adds SAUCE). Fetch real responses and adapt to the actual JSON shape. Use the raw-file URLs the API returns; do not guess URL patterns.
- NEVER call 16colo.rs from the browser. Build a server-side caching proxy on this project's backend (enable Lovable Cloud): one endpoint for API JSON, one for raw file bytes. Cache every response permanently in storage, de-duplicate concurrent requests, send a descriptive User-Agent, and only fetch what a caller actually opens. No bulk prefetch.
- Bundle a small "house pack" (CRAWL-01, six original ANSI pieces generated by code, including one long scroller and one that uses cursor movement to animate) so the whole loop works if the upstream is unreachable. Show a BBS-style error screen when a fetch fails.
- Credits screen: the art belongs to its artists; archives preserved by 16colo.rs and artpacks.org; font credit; "takedown requests: sysop@ (placeholder)".

## EXTRAS FOR THIS PASS
- Deep links: `/dial/:number/:year/:pack/:file` plays a 3-second dial+connect and lands in the viewer on that file.
- Persist handle, phone book last-call dates, files seen, speed unlocked, fast-boot flag in localStorage.
- A hidden dev route `/lab`: pick a house-pack file or paste a pack/file, choose speed, stream it on the CRT, and show parser stats (unknown sequence count, rows, bytes).
- Capture keys so browser shortcuts do not steal them where possible (preventDefault on arrows, space, PgUp/PgDn, Backspace while the machine has focus).

## DONE WHEN
- From power-on a keyboard-only user can dial, log in as GUEST, browse 1993, open a pack, watch an ANSI draw at 9600, press I for credits, and log off.
- Real ANSI from the archive renders correctly: colors, box drawing, shade blocks, cursor positioning, 80-column wrap.
- 60 fps while streaming.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dialup-ansi-archive.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/298f7169-8e27-40d1-8c38-222a2bcfc28a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
