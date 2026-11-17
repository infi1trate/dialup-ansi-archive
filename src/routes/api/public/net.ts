import { createFileRoute } from "@tanstack/react-router";

// The board's message base. Anonymous callers by design: every action validates its input,
// identifies callers only by hashed device tokens, and is rate limited per token hash and hashed IP.
export const Route = createFileRoute("/api/public/net")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handle, NetError } = await import("@/server/net");
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
        if (!body || typeof body !== "object") return Response.json({ error: "bad body" }, { status: 400 });
        try {
          return Response.json(await handle(body, request), { headers: { "cache-control": "no-store" } });
        } catch (e) {
          if (e instanceof NetError) return Response.json({ error: e.message }, { status: e.status });
          console.error("[net]", e);
          return Response.json({ error: "message base error" }, { status: 500 });
        }
      },
    },
  },
});
