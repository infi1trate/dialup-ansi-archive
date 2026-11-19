<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Dial-Up architecture
- Modules are split by role: `src/term` (parser, cells, renderer), `src/modem` (byte scheduler), `src/bbs` (virtual host), `src/crt` (WebGL2 post-process), `src/machine` (state machine, engine, storage), `src/audio` (event bus), `src/data` (archive access). Why: later passes add room, sound and multi-user features on these seams.
- The board (`src/bbs`) only writes bytes through `HostIO.send` and reads keys; client-side terminal features (mode, scrollback, info overlay) go through `HostIO.client`. Why: everything the board shows must arrive at modem speed.
- Nothing on the CRT is HTML: every screen is CP437/ANSI bytes fed to the terminal; author screens with `src/bbs/ansi.ts`, whose colors take VGA palette indexes (mapped to ANSI SGR order internally).
- The browser never calls 16colo.rs; it goes through `/api/public/archive/json` and `/api/public/archive/raw`, which cache permanently in the private `archive-cache` storage bucket. Why: polite to upstream and resilient.
- All canvas/WebGL/audio/localStorage code is created inside effects (dynamic import of `@/machine/engine` and `@/machine/machine`). Why: SSR safety.
- tsconfig turns off `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`noPropertyAccessFromIndexSignature`. Why: hot typed-array loops in the renderer and parser.
- The room (`src/components/room`) positions every object from `layout.ts` (cqw of a 16:9 stage); emissive parts (LEDs, digits) sit in their own layer above the multiply light map and reuse those coordinates. Why: darkness must never dim light sources, and parts must line up.
- Screen spill, LEDs and headlights are driven by `useRoomLive` through CSS variables/classes, never React state. Why: 60 fps with no re-renders.
- All sound is synthesized in `src/audio/engine.ts`, lazily imported on the first power/lamp click; producers only emit bus events. Telephony and handshake timings live in `src/audio/tables.ts`, shared with the machine so waits match the sound.
- Board network features (identity, oneliners, presence, views, reports, flags, counters) go only through `POST /api/public/net` (`src/server/net.ts`), which uses the service-role client; all those tables keep RLS on with no client policies. Why: every write must be validated and rate-limited server-side, and clients never see token/IP hashes.
- Device tokens are stored only as SHA-256 hashes; transfer phrases use PBKDF2; secrets (SYSOP_KEY, IP_HASH_SALT) are read from env inside handlers and their features degrade gracefully when missing. Why: no personal data and no default keys.
- Share-card PNGs (`/api/public/card`) are the only place art becomes an image; they reuse the terminal and VGA font and are cached in storage. Why: rule 1 exception for social previews only.
- Binary formats (.BIN/.XB/.ADF/.IDF) are decoded in `src/term/formats.ts` into an ANSI byte stream plus a `TermMode` palette/font, via `src/term/prepare.ts`; the gallery and share cards rasterize with DOM-free `src/term/raster.ts`. Why: every surface stays on one renderer and art still arrives at modem speed.
- Touch keys come from the board's out-of-band `io.hint(keys)`, never parsed from the byte stream; the context bar renders only those. Why: the CRT stays pure bytes.
- `src/start.ts` loads the backend auth middleware lazily so the dark first frame ships no backend client. Why: first-load budget.
- Write rate limits go through `src/lib/ratelimit.ts` (check before recording). Why: rejected attempts must not extend the window.
- Downloads live in IndexedDB (`src/machine/drive.ts`, `C:\DOWNLOAD`, size-capped, oldest evicted); DOS VIEW replays them through the board viewer with a local HostIO. Why: offline reading without a server.
- Tracker music plays only through `src/audio/kplay.ts` (lazy AudioWorklet from `public/wasm/chiptune3`) into the speaker bus in `src/audio/engine.ts`. Why: the 1.5 MB player must never touch the first load, and music needs a visible source.
- BASEMENT CRAWL daily turns and scores go through `/api/public/net` actions (`doorTurn`, `doorScore`, `doorTop`) on RLS-locked tables. Why: same validation/rate-limit path as every board write.

- Legacy display-code translation and licensed SAUCE font selection stay inside `src/term/prepare.ts`; all viewing surfaces share them so no format gets an alternate renderer.
- Archive audit tools store downloaded corpus/reference output under `/tmp/dialup-audit` and use the existing proxy serially at one request per second; repository reports contain metrics, not art copies.
