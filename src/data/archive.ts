// Archive access: everything goes through this project's caching proxy, never to 16colo.rs directly.
import { audio } from "@/audio/bus";
import { houseFile, housePack, HOUSE_PACK } from "./housepack";
import { isViewable, type GroupSummary, type PackInfo, type PackSummary, type Page } from "./types";

export class ArchiveError extends Error {}

const json = new Map<string, Promise<unknown>>();
const files = new Map<string, Promise<Uint8Array>>();

async function api<T = any>(path: string): Promise<T> {
  if (!json.has(path)) {
    audio.emit("diskSeek");
    const p = fetch(`/api/public/archive/json?path=${encodeURIComponent(path)}`).then(async (r) => {
      if (!r.ok) throw new ArchiveError(`archive returned ${r.status}`);
      return r.json();
    });
    json.set(path, p);
    p.catch(() => json.delete(path));
  }
  return json.get(path) as Promise<T>;
}

export const MIN_YEAR = 1990, MAX_YEAR = 1996;

export async function getYears(min = MIN_YEAR, max = MAX_YEAR): Promise<{ year: number; packs: number }[]> {
  const d = await api<Record<string, { packs: number }>>("/v1/year/");
  return Object.entries(d)
    .map(([y, v]) => ({ year: +y, packs: v.packs }))
    .filter((y) => y.year >= min && y.year <= max)
    .sort((x, y) => x.year - y.year);
}

export async function getYearPacks(year: number, page: number, pagesize = 60): Promise<Page<PackSummary>> {
  const d = await api(`/v1/year/${year}?pagesize=${pagesize}&page=${page}`);
  return {
    items: (d.results ?? []).map((r: any) => ({ name: r.name, year: r.year, groups: r.groups ?? [] })),
    page: d.page?.page ?? page, pages: d.page?.pages ?? 1, total: d.page?.total ?? 0,
  };
}

export async function getGroups(page: number, pagesize = 60): Promise<Page<GroupSummary>> {
  const d = await api(`/v1/group/?pagesize=${pagesize}&page=${page}`);
  return {
    items: (d.results ?? []).map((r: any) => { const name = Object.keys(r)[0]; return { name, releases: r[name]?.releases ?? 0 }; }),
    page: d.page?.page ?? page, pages: d.page?.pages ?? 1, total: d.page?.total ?? 0,
  };
}

export async function getGroupPacks(group: string, min = MIN_YEAR, max = MAX_YEAR): Promise<PackSummary[]> {
  const d = await api(`/v1/group/${encodeURIComponent(group).replace(/%20/g, "+")}`);
  const packs: Record<string, string[]> = d.results?.packs ?? {};
  const out: PackSummary[] = [];
  for (const [y, names] of Object.entries(packs)) {
    if (+y < min || +y > max) continue;
    for (const n of names) out.push({ name: n, year: +y, groups: [group] });
  }
  return out.sort((x, y) => x.year - y.year || x.name.localeCompare(y.name));
}

export async function getPack(name: string, groups: string[] = []): Promise<PackInfo> {
  if (name.toLowerCase() === HOUSE_PACK) return housePack();
  const d = await api(`/v1/pack/${name}?sauce=true&filesize=true`);
  const r = d.results?.[0];
  if (!r) throw new ArchiveError("pack not found");
  const fl = Object.entries(r.files ?? {}).map(([n, v]: [string, any]) => ({
    name: n, artists: v.artists ?? [], size: v.file?.size ?? null, viewable: isViewable(n),
  }));
  fl.sort((x, y) => Number(y.viewable) - Number(x.viewable) || x.name.localeCompare(y.name));
  const fileId = r.fileid ?? (fl.find((f) => /^file_id\.diz$/i.test(f.name))?.name ?? null);
  return { name, year: r.year, groups: r.groups ?? groups, files: fl, fileId };
}

export async function getFile(pack: string, file: string): Promise<Uint8Array> {
  if (pack.toLowerCase() === HOUSE_PACK) {
    const f = houseFile(file);
    if (!f) throw new ArchiveError("no such file");
    return f;
  }
  const k = `${pack}/${file}`;
  if (!files.has(k)) {
    audio.emit("diskSeek");
    const p = fetch(`/api/public/archive/raw?pack=${encodeURIComponent(pack)}&file=${encodeURIComponent(file)}`).then(async (r) => {
      if (!r.ok) throw new ArchiveError(`archive returned ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    files.set(k, p);
    p.catch(() => files.delete(k));
  }
  return files.get(k)!;
}
