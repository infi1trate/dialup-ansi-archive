import { createFileRoute } from "@tanstack/react-router";

// Share image for a postcard link. Cached in storage; withdrawn or expired cards get a 404.
export const Route = createFileRoute("/api/public/postcard-card")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const { validId } = await import("@/lib/postcard");
        if (!validId(id)) return new Response("bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { readPostcard } = await import("@/server/postcard");
        const r = await readPostcard(supabaseAdmin, id, new Date());
        if (r.status !== "ok") return new Response("gone", { status: 404 });
        const { cached, cacheKey } = await import("@/server/archive-proxy");
        const { renderPostcardCard } = await import("@/server/postcard-card");
        try {
          const jpg = await cached(await cacheKey("postcard-v1", id), () => renderPostcardCard(r.card.lines.find((l) => l.trim()) ?? "", r.card.signature));
          return new Response(jpg as unknown as BodyInit, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
        } catch (e) { return new Response(String(e), { status: 502 }); }
      },
    },
  },
});
