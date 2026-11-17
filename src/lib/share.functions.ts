import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const getShareMeta = createServerFn({ method: "GET" })
  .inputValidator((d: { pack: string; file: string; year: string }) => ({ pack: String(d.pack).slice(0, 80), file: String(d.file).slice(0, 120), year: Number(d.year) || 1994 }))
  .handler(async ({ data }) => {
    const req = getRequest();
    const url = new URL(req.url);
    const sandboxHost = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    const { shareMeta, shareLine } = await import("@/server/share");
    let line = `${data.file} (${data.pack}, ${data.year})`;
    try { line = shareLine(await shareMeta(data.pack, data.file, data.year)); } catch { /* upstream down: plain line */ }
    const card = `${origin}/api/public/card?pack=${encodeURIComponent(data.pack)}&file=${encodeURIComponent(data.file)}&year=${data.year}`;
    return { line, card };
  });
