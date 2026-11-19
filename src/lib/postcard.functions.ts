import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const getPostcard = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => ({ id: String(d.id).slice(0, 20) }))
  .handler(async ({ data }) => {
    const req = getRequest();
    const url = new URL(req.url);
    const sandboxHost = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readPostcard } = await import("@/server/postcard");
    try {
      const r = await readPostcard(supabaseAdmin, data.id, new Date());
      return { ...r, origin, image: r.status === "ok" ? `${origin}/api/public/postcard-card?id=${data.id}` : null };
    } catch { return { status: "missing" as const, origin, image: null }; }
  });
