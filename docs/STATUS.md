# Dial-Up status (passes 1-5)

## 1. Verified working (test browser = Playwright Chromium, software GL)
- Pass 1-3 loop: power on, boot, DOS, TELEWIRE, dial, GUEST, browse 1993, view ANSI, I info, logoff; deep links; /lab; /credits; cross-browser oneliners/logons/presence.
- Rate limit: test "first accepted, next rejected, accepted after window"; parallel burst lets exactly one through (src/test/ratelimit.test.ts).
- `?debug=busy` BUSY + redial; `?debug=time=1` time's-up then NO CARRIER.
- Brightness/contrast/modem-volume knobs by scroll wheel, persisted.
- Modem setup 2400 hard mode and back; 14400/28800 locked until unlocked.
- New-user form; second browser logs in with handle + transfer phrase (wrong phrase rejected).
- Who's Online refresh every 15 s; power off mid-stream and back on; portrait desktop starts leaned in.
- Backend down: board says "the message base is offline" and falls back to seeds; art still streams.
- WARDIAL.EXE finds 0113/0142/0167/0193/0199; manual dial M 5550113 reaches VOID//NODE; password works; 28800 unlocked.
- The Attic unlocks after 10 files; Animations area; XBin AMBER.XB with own palette/font; /gallery.
- Phone 390x844 touch: whole call loop by keycaps and row taps.
- Pass 5:
  - Download: D on a real 1996 file (mist0896 KS!-LOGO.ANS, 33,088 B) showed the ZMODEM screen at 960 cps, saved to C:\DOWNLOAD. House CRWL-LGO.ANS downloaded, hung up, DIR C:\DOWNLOAD listed it, VIEW drew it on the CRT.
  - Music: real FB-GK.S3M ("Guru Kink", 508,849 B, mist0896) downloaded and played in KPLAY: 11 channels, 110 orders, order/row/time counters and VU bars moving; desk speaker LED lit. Not listened to by ear (headless).
  - BASEMENT CRAWL: a pathfinding bot played two full runs as handle P5Crawler (died on floor 2 both times); scores 920 and 1470 posted and returned by the high-score table; "10 floor attempts left" then "6 left" seen.
  - Sysop chat: answered on the 4th page; split screen; "who are you" and "secret" got keyword replies including the 555-01?3 hint; Esc ends.
  - Screensaver: idle at DOS shows the starfield (timer shortened in test); a key returns to C:\>.
  - Wrong URL (/no/such/page): room loads, TELEWIRE prints ATDT, NO CARRIER, "error 404 ... not in service", returns to DOS. Page title "Dial-Up".
  - VOID//NODE logo fixed (bottom strokes were drawn in black) and re-checked on screen.
  - Screenshots in docs/shots/*.b64 decode to JPEGs: room-menu 800x450 25 KB, tube-art 640x480 27 KB, sheet 800x450 26 KB.
- 54 tests pass; typecheck clean; production build OK.

## 2. Built but untested
- Esc-abort of a transfer, Enter-skip of a transfer; RD/HDD LED flicker during a transfer (one RD sample only).
- DEL <file> (typed in the test; result not read back); info panel I inside a DOS VIEW.
- 3 MB drive cap eviction in a browser (unit-tested only).
- Fatal runtime error screen with reboot (no error was forced in the browser).
- Speaker volume knob drag/scroll; music volume persistence; turbo/mute/reduced motion/lamp persistence across reload this pass (turbo persistence is new code).
- Always-answer on the first page after 20 files viewed (unit-tested rule only).
- .MOD/.XM/.IT playback (only S3M tried). 512-glyph XBin fonts, real ADF/IDF, sysop console with a real key.
- 60 fps on real integrated graphics; audio by ear; haptics.

## 3. Known bugs and gaps
- Door turns: one attempt is taken per floor entered; clearing all five floors uses five. The score route trusts a plausible client score (capped, but not replayed server-side).
- Door turn and rate-limit tables use check-then-write, not transactions; heavy concurrency on one identity could race.
- Transfer timing is metered with invisible filler bytes so it lasts as long as the real file would.
- Sysop chat screenshot shows Static's reply still being typed; long replies wrap onto a second line.
- VOID password is in the shipped board code (puzzle, not security).
- Fake DOS file dates use 1993 regardless of pack year.

## 4. Choices made
- Blink 1.875 Hz text / 2.5 Hz cursor; reduced motion = steady text, no flicker.
- PabloDraw 24-bit color rendered; parser corpus of 42 real files: 0 unknown sequences.
- Music: chiptune3 0.8.10 (MIT) wrapping libopenmpt (BSD), credited on the board credits screen and /credits; loaded only on first play from /wasm/chiptune3.
- Music is routed through the two desk speakers (panned left/right, small-speaker EQ); the right speaker's knob sets music volume.
- Downloads live in the browser only (IndexedDB), 3 MB cap, oldest dropped first.
- BASEMENT CRAWL is original: 5 floors, dust bunnies, a rogue dot-matrix printer, the sump pump; floppies, batteries, duct tape.
- Sysop answers roughly every 4th page; scripted keyword replies only.
- Screensaver after 3 minutes idle at DOS or in TELEWIRE only, never in a call.
- noindex is on site-wide; remove it at launch in the root route.

## 5. Owner to-do
- Set SYSOP_KEY (long random string) as a backend secret to enable the console; set IP_HASH_SALT for IP hashing.
- Test data was NOT deleted (approval declined). Remove by hand: callers Probe9957, Tester8804, Probe30410, Alpha769, Beta566, Burst474, Gamma*, every P4test* caller, and P5Crawler (pass 5), with their call_log, oneliners, presence, reports, views, rate hits, door_scores (2 rows), door_turns and test daily_counters rows.
- Lift noindex at launch. Publish and check share cards and 60 fps on a real laptop.

## 6. Weight (production build, gzip -9)
- First load (dark room, before power): about 120 KB JS + 145 KB WebP images (lazy) + CSS. No terminal, CRT, audio, board, house pack or backend client.
- After power click: about 55 KB JS (machine, board, house pack, terminal, CRT, font, archive client).
- Music player: 518 KB gz (1.5 MB raw), fetched only on the first music play. KPLAY glue under 1 KB.
- Backend client about 57 KB gz, loaded on the first server call.
