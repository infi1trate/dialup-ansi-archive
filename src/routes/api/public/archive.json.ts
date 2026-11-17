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
          const bytes = await getApiJson(path);
          return new Response(bytes as unknown as BodyInit, {
            headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
          });
        } catch (e) {
          return new Response(String(e), { status: 502 });
        }
      },
    },
  },
});
