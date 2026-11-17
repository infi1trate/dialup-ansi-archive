# Dial-Up status (passes 1-4)

## 1. Verified working (test browser = Playwright Chromium, software GL)
- Pass 1-3 loop: power on, boot, DOS, TELEWIRE, dial, GUEST, browse 1993, view ANSI, I info, logoff; deep links; /lab; /credits; cross-browser oneliners/logons/presence.
- Rate limit: unit test "first accepted, next rejected, accepted after window", rejected attempts do not extend it; a parallel burst lets exactly one through (src/test/ratelimit.test.ts, memory store).
- `?debug=busy` forces BUSY + automatic redial countdown, then CONNECT. `?debug=time=1` kicks to the time's-up screen after one minute, then NO CARRIER.
- Brightness, contrast and modem-volume knobs respond to the scroll wheel and persist (drag not scripted).
- Modem setup: 2400 hard mode selectable, back to 9600; 14400/28800 show as locked until unlocked.
- New-user form (handle, city, joke, transfer phrase) on screen; second fresh browser logs in with the handle, wrong phrase rejected, right phrase accepted.
- Who's Online shows the real node row and refreshes every 15 s (changed rows only, code-reviewed; tick seen once).
- Power off mid-stream, power back on: reboots cleanly, no errors.
- Portrait desktop viewport starts leaned in with the tube centered. Fixed: an automated click scrolled the room sideways; the room now refuses to scroll.
- Backend down (all /api/public/net requests aborted): login, last callers, oneliners and who's online say "the message base is offline" and fall back to seeds; art still streams.
- WARDIAL.EXE finds 0113, 0142, 0167, 0193, 0199 (Esc skips). Manual dial M 5550113 reaches VOID//NODE; password STAIRWELL works; 28800 unlocked; files sorted by most viewed; red skin.
- The Attic appears in the phone book after 10 files viewed; news says "a new board came online"; years 1997+ listed.
- [A]nimations area: SPINNER and RAIN animate; no ENTER-finish key offered (Enter still works).
- XBin AMBER.XB renders with its own palette and font through the modem; info panel shows it.
- Phone 390x844 with touch: whole call loop by keycaps and row taps (power, dial, GUEST via OS keyboard input, 1993, pack, piece, info, logoff to NO CARRIER). Portrait art shows the "turn your phone" box; landscape fills the tube.
- Gallery /gallery and /gallery/:year/:pack render on plain canvas (earlier this pass).
- Production build: first-load JS excludes terminal, CRT, audio, board, house pack and backend client (import graph checked).
- 42 tests pass; typecheck clean.

## 2. Built but untested
- Knob dragging (only wheel tested); swipe scroll on finished art (test piece was shorter than the screen).
- XBin compression with real archive files, 512-glyph XBin fonts (only the first 256 glyphs are used), ADF from the archive, IDF (decoder is a best guess; no real file tested).
- Sysop console with a real SYSOP_KEY set; 14-day counters table.
- Presence expiry for callers who vanish; share-card PNGs for wide pieces after the scale-to-fit change.
- 60 fps on real integrated graphics; audio by ear (Playwright cannot listen).
- Haptic tick (no device).

## 3. Known bugs and gaps
- Rate limiter in the database is check-then-insert-then-rank, not a transaction; heavy concurrency could, in rare cases, reject both of two racing posts. It never lets extra posts through in tests.
- VOID password is in the shipped board code (it's a puzzle, not security).
- `?debug=offline` makes every message-base call fail (added last; verified only via the request-blocking test above).
- Production preview server (vite preview) failed with a missing server file in a copied workspace; the build itself is fine.
- Board text is ASCII-checked by eye only; a few long lines in narrow menus could clip.

## 4. Choices made
- Blink 1.875 Hz text / 2.5 Hz cursor (under 3 flashes per second); CRT flicker is a slow 0.4 Hz drift; reduced motion = steady text, no flicker.
- PabloDraw 24-bit `ESC[0;R;G;Bt`/`ESC[1;R;G;Bt` and SGR 38/48 are rendered as true color; `ESC[?7h`, `ESC[=3h`, `ESC[?33h` (iCE) accepted; harmless SGRs (e.g. 24) ignored.
- Parser corpus: 42 real .ANS/.ICE/.ASC files 1990-1996 via the proxy, one at a time. Before: 41 files 0 unknown, TB-SANC.ASC (asia0595) 1 unknown (SGR 24). After the fix: 0 unknown in all 42.
- Binary formats are converted to an ANSI byte stream so they still paint at modem speed.
- Attic covers 1997-today with the same skin; VOID is never listed in the phone book.
- Stair-creak clue: one panned creak soon after power-on (answer 1 -> 555-0113); second sticky note sits under the keyboard edge.
- Mobile: tube-only below 820 px or on touch; keys come from io.hint, not the byte stream.

## 5. Owner to-do
- Set SYSOP_KEY (long random string) as a backend secret to enable the console; set IP_HASH_SALT for IP hashing. Both degrade gracefully when missing.
- Test data was NOT deleted (approval declined). Remove by hand: callers Probe9957, Tester8804, Probe30410, Alpha769, Beta566, Burst474, Gamma*, and every P4test* caller from this pass, with their call_log, oneliners (2), presence (5), reports (2), views (3), rate hits and test daily_counters rows.
- Publish and check share cards and the 60 fps bar on a real laptop.

## 6. Weight (production build, gzip -9)
- First load (dark room, before power): 123.7 KB JS (378 KB raw) + 145 KB WebP images (lazy) + CSS.
- After power click: 45.8 KB JS (121 KB raw): machine, board, house pack, terminal, CRT, audio, font.
- Backend client (56.6 KB gz) loads only on the first server call; gallery, lab and credits are separate small chunks.
