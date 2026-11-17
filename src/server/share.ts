// Server-only: credit metadata for a piece (used by share cards and deep-link meta tags).
export interface ShareMeta { title: string; artist: string; group: string; pack: string; year: number; file: string }

export async function shareMeta(pack: string, file: string, year: number): Promise<ShareMeta> {
  const base: ShareMeta = { title: file, artist: "unknown artist", group: "unknown group", pack, year, file };
  const { HOUSE_PACK, housePack, houseFile } = await import("@/data/housepack");
  const { parseSauce } = await import("@/term/sauce");
  if (pack.toLowerCase() === HOUSE_PACK) {
    const hp = housePack(), f = hp.files.find((x) => x.name.toLowerCase() === file.toLowerCase());
    const bytes = houseFile(file);
    const s = bytes ? parseSauce(bytes).sauce : null;
    return { ...base, year: hp.year, title: s?.title || file, artist: s?.author || f?.artists[0] || base.artist, group: s?.group || "Crawlspace" };
  }
  const { getApiJson } = await import("@/server/archive-proxy");
  const j = JSON.parse(new TextDecoder().decode(await getApiJson(`/v1/pack/${pack}?sauce=true&filesize=true`)));
  const r = j?.results?.[0];
  const key = Object.keys(r?.files ?? {}).find((k) => k.toLowerCase() === file.toLowerCase());
  const e = key ? r.files[key] : null;
  const sauce = e?.sauce ?? e?.file?.sauce ?? null;
  return {
    ...base, year: r?.year ?? year, file: key ?? file,
    title: (sauce?.title || "").trim() || key || file,
    artist: (sauce?.author || "").trim() || e?.artists?.[0] || base.artist,
    group: (sauce?.group || "").trim() || r?.groups?.[0] || base.group,
  };
}

export const shareLine = (m: ShareMeta) => `${m.title} by ${m.artist} / ${m.group} (${m.pack}, ${m.year})`;
