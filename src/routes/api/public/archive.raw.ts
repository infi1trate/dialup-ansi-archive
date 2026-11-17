import { createFileRoute } from "@tanstack/react-router";

// Public, read-only proxy for raw art file bytes from the archive.
export const Route = createFileRoute("/api/public/archive/raw")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const pack = q.get("pack") ?? "";
        const file = q.get("file") ?? "";
        if (!/^[A-Za-z0-9._\-]{1,80}$/.test(pack) || !file || file.length > 120 || file.includes("/"))
          return new Response("bad request", { status: 400 });
        const { getRawFile } = await import("@/server/archive-proxy");
        const { hiddenFiles } = await import("@/server/net");
        if ((await hiddenFiles(pack).catch(() => new Set<string>())).has(file.toLowerCase()))
          return new Response("this file has been taken down", { status: 410 });
        try {
          const bytes = await getRawFile(pack, file);
          return new Response(bytes as unknown as BodyInit, {
            headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=3600" },
          });
        } catch (e) {
          return new Response(String(e), { status: 502 });
        }
      },
    },
  },
});
