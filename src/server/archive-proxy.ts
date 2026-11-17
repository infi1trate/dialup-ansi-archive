// Server-only caching proxy for the Sixteen Colors archive API.
// Import this module dynamically from inside server route handlers only.
const UPSTREAM = "https://api.16colo.rs";
const BUCKET = "archive-cache";
const UA = "DialUp-BBS/1.0 (browser BBS simulator; caching proxy, fetches on demand only)";

const inflight = new Map<string, Promise<Uint8Array>>();

// Allowed API paths: years, a year's packs, a pack, the group list, one group.
const JSON_PATH = /^\/v1\/(year\/(\d{4})?|pack\/[A-Za-z0-9._\-]+|group\/([A-Za-z0-9._\-%+ ]+)?)(\?[A-Za-z0-9=&._\-]*)?$/;

export function isAllowedJsonPath(p: string) {
  return JSON_PATH.test(p) && p.length < 200;
}

async function cacheKey(prefix: string, id: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}/${hex}`;
}

async function cached(key: string, fetcher: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hit = await supabaseAdmin.storage.from(BUCKET).download(key);
    if (hit.data) return new Uint8Array(await hit.data.arrayBuffer());
    const bytes = await fetcher();
    await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, bytes, { contentType: "application/octet-stream", upsert: true });
    return bytes;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

async function upstream(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function getApiJson(path: string): Promise<Uint8Array> {
  return cached(await cacheKey("json", path), () => upstream(UPSTREAM + path));
}

export async function getRawFile(pack: string, file: string): Promise<Uint8Array> {
  const key = await cacheKey("raw", `${pack}/${file}`);
  return cached(key, async () => {
    // Resolve the file through the pack data the API returns (gallery URL + raw file name).
    const json = JSON.parse(
      new TextDecoder().decode(await getApiJson(`/v1/pack/${pack}?sauce=true&filesize=true`)),
    );
    const r = json?.results?.[0];
    const entry = r?.files?.[file];
    if (!r || !entry?.file?.raw) throw new Error("file not in pack");
    const gallery: string = r.gallery || `https://16colo.rs/pack/${pack}`;
    return upstream(`${gallery}/raw/${encodeURIComponent(entry.file.raw)}`);
  });
}
