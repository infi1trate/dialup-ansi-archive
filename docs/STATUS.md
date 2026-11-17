# Dial-Up: status after pass 3

## 1. Verified in the test browser (headless Chromium, Playwright)
- Pass 1: power on, boot, DOS, Telewire, dial 555-0142, GUEST login, browse 1993, open an ACiD pack, stream an ANSI at 9600, I info panel, logoff, NO CARRIER. Deep link `/dial/...` lands in the viewer. `/lab` streams with parser stats.
- Pass 2: dark room first frame, screen color spills onto wall/desk, lean in/out readable, lamp, turbo display 33/66, modem LEDs during a call, escape-hatch mute persists, `/credits`.
- Pass 3, two separate browser contexts (two device tokens): NEW signup on both; B's Last Callers lists A; B's oneliners wall shows A's line; Who's Online on A shows A and B as nodes 1 and 2 with city, speed and activity.
- Info panel shows the deep-link "phone number". R in the viewer files a report. `!` on the main menu asks for the key and answers "Console disabled" when SYSOP_KEY is unset.
- API checks: reserved/profane handles rejected, duplicate handle (any case) rejected, transfer phrase login, view counts feed Top 10, hidden flag filters JSON and raw proxy (410), funnel counters increment.
- A 12-request parallel burst of oneliner posts was all rejected (429).
- Share card PNG (`/api/public/card`) renders 1200x630 and is cached; deep-link pages carry title/OG/Twitter tags like "ACID-RN.ANS by r noble / acid (acdu0193, 1993)".
- Monitor fills 57% of frame width; sticky note sits on the bezel, off the tube.
- Unit tests: 24 passing (`bunx vitest run`).

## 2. Built but untested
- Sysop console with a real key (list/hide oneliners, ban, reports, hide/unhide file, 14-day counters): only the disabled path was exercised.
- New-device login via transfer phrase in the UI (API path tested only).
- "Message base offline" fallback with the backend actually down.
- Presence expiry after a closed tab (leave beacon + 3-minute staleness).
- Social crawlers reading the og:image (tags present, not checked with a real crawler).
- From pass 2: brightness/contrast and modem-volume knobs, portrait default lean-in, busy signal + redial, 60-minute time-out, every sound by ear.
- 60 fps: never established; the sandbox browser renders in software (~30 fps).

## 3. Known bugs and gaps
- Rate-limit hits are recorded before checking, so a rejected attempt also extends the window.
- The burst test ran from an IP that had already posted, so "first one accepted, rest rejected" was not shown in a single burst.
- Profanity list is short and English-only; leetspeak evasion partly handled.
- IP hashes use a built-in salt when IP_HASH_SALT is unset (weaker, still not reversible to an IP without brute force over the IPv4 space).
- Oneliners, reports and test callers created during testing remain in the database (handles like Alpha*, Beta*, Tester*, Burst*).
- Share card shows only the first 25 rows; wide (>80 col) pieces are cropped, not scaled.
- Who's Online redraws only on entry; it is not live while you stare at it.

## 4. Choices made
- All tables deny direct client access (RLS on, no policies, service-role grants only); every read/write goes through `POST /api/public/net`, which validates input.
- Device token: 32 random bytes in localStorage; server stores only SHA-256. Transfer phrase: PBKDF2-SHA256, 100k iterations, random salt.
- Oneliner limit: one per 10 minutes per token hash AND per IP hash (two people behind one NAT share it).
- Last callers padded with the seeded fictional callers below ten real ones.
- GUEST views count toward Top 10 by device hash but cannot post.
- Share cards cached under `card-v2/` in the private archive-cache bucket.
- Pack groups come from the cached year listing (pack JSON has no groups).

## 5. Owner to-do by hand
- Sysop console: add a secret named `SYSOP_KEY` in Project Settings -> Secrets with a long random value you make up (e.g. `openssl rand -hex 24`). No default exists; without it the console says "console disabled".
- Optional: add `IP_HASH_SALT` (any long random string) for stronger IP hashing. Changing it later resets per-IP limits only.
- Replace the takedown placeholder (`sysop@`) in the credits screen and `/credits` with a real contact.
- Delete test rows if you want a clean board before launch.

## 6. First-load weight (home page, measured in dev)
- Images: ~144 KB WebP total (room assets; props lazy-load). No other images.
- JS: ~2.9 MB in the dev server (unminified, unbundled modules incl. React and router). A production build was not measured in this pass; expect a fraction of that after minification. Audio engine, machine and CRT load only after the first power click.
