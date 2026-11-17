import { createFileRoute } from "@tanstack/react-router";

// Public, read-only proxy for archive API JSON. Only whitelisted archive paths are served.
export const Route = createFileRoute("/api/public/archive/json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        const { getApiJson, isAllowedJsonPath } = await import("@/server/archive-proxy");
        if (!isAllowedJsonPath(path)) return new Response("bad path", { status: 400 });
        try {
          let bytes: Uint8Array = await getApiJson(path);
          const pm = /^\/v1\/pack\/([A-Za-z0-9._\-]+)/.exec(path);
          if (pm) {
            // hidden files (sysop flags) are not listed
            const { hiddenFiles } = await import("@/server/net");
            const hidden = await hiddenFiles(pm[1]).catch(() => new Set<string>());
            if (hidden.size) {
              const j = JSON.parse(new TextDecoder().decode(bytes));
              const files = j?.results?.[0]?.files;
              if (files) for (const n of Object.keys(files)) if (hidden.has(n.toLowerCase())) delete files[n];
              bytes = new TextEncoder().encode(JSON.stringify(j));
            }
          }
          return new Response(bytes as unknown as BodyInit, {
            headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
          });
        } catch (e) {
          return new Response(String(e), { status: 502 });
        }
      },
    },
  },
});
