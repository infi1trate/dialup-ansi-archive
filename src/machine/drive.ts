// C:\DOWNLOAD on the Kestrel's hard disk: IndexedDB, about 3 MB, oldest files dropped first.
// Browser-only; every call fails soft (private mode, blocked storage).
export interface DiskFile { name: string; bytes: Uint8Array; at: number; pack: string; year: number; file: string; artists: string[]; groups: string[] }
export const DRIVE_CAP = 3 * 1024 * 1024;
const DB = "dialup.drive.v1", STORE = "download";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "name" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(req ? req.result : undefined); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
}

/** 8.3 name the way DOS would truncate it. */
export function dosName(name: string) {
  const base = name.replace(/^.*[\\/]/, "").toUpperCase().replace(/[^A-Z0-9._\-!#$%&@^~]/g, "_");
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/\./g, "").slice(0, 8) || "FILE";
  const ext = dot > 0 ? base.slice(dot + 1).slice(0, 3) : "";
  return ext ? `${stem}.${ext}` : stem;
}

export async function list(): Promise<DiskFile[]> {
  try { return ((await tx<DiskFile[]>("readonly", (s) => s.getAll())) ?? []).sort((p, q) => p.at - q.at); } catch { return []; }
}
export async function get(name: string): Promise<DiskFile | null> {
  try { return (await tx<DiskFile>("readonly", (s) => s.get(diskName(name)))) ?? null; } catch { return null; }
}
export async function del(name: string): Promise<boolean> {
  if (!(await get(name))) return false;
  try { await tx("readwrite", (s) => { s.delete(diskName(name)); }); return true; } catch { return false; }
}
/** Pure: which existing files must go so `incoming` bytes fit under the cap (oldest first). */
export function evictions(files: { name: string; size: number; at: number }[], incoming: number, cap = DRIVE_CAP): string[] {
  const sorted = [...files].sort((p, q) => p.at - q.at);
  let used = sorted.reduce((n, f) => n + f.size, 0);
  const out: string[] = [];
  for (const f of sorted) { if (used + incoming <= cap) break; out.push(f.name); used -= f.size; }
  return out;
}
export async function put(f: Omit<DiskFile, "name" | "at"> & { name: string }): Promise<{ name: string; dropped: string[] } | null> {
  if (f.bytes.length > DRIVE_CAP) return null;
  try {
    const name = f.pack === "fiction" ? diskName(f.name) : dosName(f.name);
    const existing = (await list()).filter((x) => x.name !== name);
    const drop = evictions(existing.map((x) => ({ name: x.name, size: x.bytes.length, at: x.at })), f.bytes.length);
    await tx("readwrite", (s) => { for (const d of drop) s.delete(d); s.put({ ...f, name, at: Date.now() }); });
    return { name, dropped: drop };
  } catch { return null; }
}
export const used = (fs: DiskFile[]) => fs.reduce((n, f) => n + f.bytes.length, 0);

/** DOS DIR date for a downloaded file: today's month/day in the pack's year (MM-DD-YY). */
export function dosDate(year: number, d: Date): string {
  const yy = Number.isFinite(year) && year > 1900 ? year % 100 : 93;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(yy).padStart(2, "0")}`;
}

/** Warez keys retain DOS directories; old downloads retain their flat 8.3 keys. */
export function diskName(name:string){return name.includes("\\")||name.includes("/")?resolvePath(name):dosName(name);}
export function resolvePath(input:string,cwd="C:\\"){const raw=input.replace(/\//g,"\\").toUpperCase();const absolute=/^C:/.test(raw)||raw.startsWith("\\");const parts=(absolute?raw.replace(/^C:/,""):cwd.slice(2)+"\\"+raw).split("\\");const out:string[]=[];for(const p of parts){if(!p||p===".")continue;if(p===".."){out.pop();continue;}out.push(dosName(p));}return "C:\\"+out.join("\\");}
export function directoryEntries(files:DiskFile[],path:string){const root=resolvePath(path).replace(/\\$/,"")+"\\";const entries=new Map<string,{name:string;directory:boolean;file?:DiskFile}>();for(const f of files){const key=f.pack==="fiction"?resolvePath(f.name):"C:\\DOWNLOAD\\"+f.name;if(!key.startsWith(root))continue;const tail=key.slice(root.length),name=tail.split("\\")[0];if(!name)continue;entries.set(name,{name,directory:tail.includes("\\"),...(tail.includes("\\")?{}:{file:f})});}return [...entries.values()];}
