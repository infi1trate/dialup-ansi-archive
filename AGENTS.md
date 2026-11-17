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
