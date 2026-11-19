import { createFileRoute } from "@tanstack/react-router";

// Share card PNG for a deep-linked piece. Cached permanently in storage.
export const Route = createFileRoute("/api/public/card")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const pack = q.get("pack") ?? "", file = q.get("file") ?? "", year = Number(q.get("year")) || 1994;
        if (!/^[A-Za-z0-9._\-]{1,80}$/.test(pack) || !file || file.length > 120 || file.includes("/"))
          return new Response("bad request", { status: 400 });
        const { hiddenFiles } = await import("@/server/net");
        if ((await hiddenFiles(pack).catch(() => new Set<string>())).has(file.toLowerCase())) return new Response("gone", { status: 410 });
        const { cached, cacheKey, getRawFile } = await import("@/server/archive-proxy");
        const { shareMeta, shareLine } = await import("@/server/share");
        const { renderCard } = await import("@/server/card");
        const { HOUSE_PACK, isHousePack, houseFile } = await import("@/data/housepack");
        try {
          const png = await cached(await cacheKey("card-v3", `${pack}/${file}`), async () => {
            const meta = await shareMeta(pack, file, year);
            const bytes = isHousePack(pack) ? houseFile(file) : await getRawFile(pack, meta.file);
            if (!bytes) throw new Error("no such file");
            return renderCard(file, bytes, shareLine(meta), "dial 555-0142  -  DEAD CARRIER  -  art preserved by 16colo.rs");
          });
          return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
        } catch (e) {
          return new Response(String(e), { status: 502 });
        }
      },
    },
  },
});
