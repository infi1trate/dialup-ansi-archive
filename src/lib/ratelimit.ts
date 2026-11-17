// Sliding-window rate limit core. Checks BEFORE recording, so rejected attempts never extend the window.
// Race-safe: after recording, a hit whose rank in the window exceeds max is withdrawn and rejected.
export interface HitStore {
  count(key: string, action: string, sinceMs: number, upToId?: number): Promise<number>;
  record(keys: string[], action: string): Promise<number[]>; // returns ids, monotonically increasing
  remove(ids: number[]): Promise<void>;
}
export async function allow(store: HitStore, keys: string[], action: string, max: number, windowSec: number, now = Date.now()): Promise<boolean> {
  const since = now - windowSec * 1000;
  for (const k of keys) if ((await store.count(k, action, since)) >= max) return false;
  const ids = await store.record(keys, action);
  for (let i = 0; i < keys.length; i++) {
    if ((await store.count(keys[i], action, since, ids[i])) > max) { await store.remove(ids); return false; }
  }
  return true;
}
/** In-memory store with an injectable clock, for tests. */
export function memoryStore(clock: () => number): HitStore {
  let seq = 0; const hits: { id: number; key: string; action: string; at: number }[] = [];
  return {
    async count(key, action, since, upTo) { return hits.filter((h) => h.key === key && h.action === action && h.at >= since && (upTo === undefined || h.id <= upTo)).length; },
    async record(keys, action) { return keys.map((key) => { const id = ++seq; hits.push({ id, key, action, at: clock() }); return id; }); },
    async remove(ids) { for (const id of ids) { const i = hits.findIndex((h) => h.id === id); if (i >= 0) hits.splice(i, 1); } },
  };
}
