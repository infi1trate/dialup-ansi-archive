// Film mode only (never in production builds): the message base answers from this fixed, invented cast so no
// real or test caller ever appears on film. Pure: `now` is passed in so the replies stay deterministic.
export const FILM_HANDLE = "KESTREL";
/** Invented regulars who populate who's online, last callers, oneliners, THE WALL and score tables. */
export const FILM_CAST = ["NullPtr", "Vera_9", "mothman", "sysop's cat", "Halcyon", "dot.matrix"] as const;
const CITY: Record<string, string> = { KESTREL: "Port Ellis", NullPtr: "Ashby", Vera_9: "Lakewood", mothman: "Grayson", "sysop's cat": "under the desk", Halcyon: "Milltown", "dot.matrix": "Somerset" };
const LEVEL: Record<string, string> = { KESTREL: "ELITE", NullPtr: "ELITE", Vera_9: "VALIDATED", mothman: "VALIDATED", "sysop's cat": "NEW USER", Halcyon: "VALIDATED", "dot.matrix": "NEW USER" };
const ONELINERS: [string, string][] = [
  ["Vera_9", "latchkey drop tonight? my 14.4 is warmed up"],
  ["mothman", "who keeps calling at 3am. oh. me."],
  ["sysop's cat", "zzzzzzzzzzzzzzzzzzzzzzzzzzzz"],
  ["NullPtr", "half blocks forever, quarter blocks never"],
  ["Halcyon", "mom picked up the extension mid-zmodem. RIP"],
  ["dot.matrix", "first call. that logo is so red"],
];
const WALL = [
  { id: 3, handle: "NullPtr", body: "the corner: buy low in the rail yards,\nsell at the arcade. you're welcome.", hidden: false },
  { id: 2, handle: "Vera_9", body: "anyone have the rest of the ensi pack?", hidden: false },
  { id: 1, handle: "sysop's cat", body: "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk", hidden: false },
];
const caller = (calls: number) => ({ handle: FILM_HANDLE, city: CITY.KESTREL, calls, files: 148, speed: 28800, banned: false, level: "ELITE" });
const ago = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();
const scores = (now: number) => ({
  daily: [{ handle: "mothman", score: 4120, floor: 4 }, { handle: "NullPtr", score: 3380, floor: 3 }, { handle: "Vera_9", score: 1960, floor: 2 }],
  all: [{ handle: "NullPtr", score: 11840, floor: 5 }, { handle: "mothman", score: 9020, floor: 5 }, { handle: "Halcyon", score: 6400, floor: 4 }],
  rows: [{ handle: "NullPtr", score: 11840, created_at: ago(now, 600) }, { handle: "mothman", score: 9020, created_at: ago(now, 1400) }],
});

/** The film's message base. undefined = pass through to the real server (read-only, archive-derived data only). */
export function filmNet(action: string, body: Record<string, unknown>, now: number): Record<string, unknown> | null | undefined {
  const speed = [2400, 9600, 14400, 28800].includes(body.speed as number) ? (body.speed as number) : 14400;
  switch (action) {
    case "scene": return undefined; // the weekly scene bulletin is built from the public archive
    case "hello": return { caller: caller(211) };
    case "logon": return { caller: caller(212), calledBack: false, billWaiting: false, level: "ELITE", promotion: null, speed, minutes: 60, remainingSeconds: 3600, exempt: false, callSession: "f11m0000000000000000000000000001" };
    case "beat": return { time: { remainingSeconds: 3540 }, online: [
      { handle: FILM_HANDLE, level: "ELITE", city: CITY.KESTREL, speed, doing: String(body.doing ?? "at the main menu"), me: true },
      { handle: "Vera_9", level: LEVEL.Vera_9, city: CITY.Vera_9, speed: 14400, doing: "viewing EARTH.ANS", me: false },
      { handle: "mothman", level: LEVEL.mothman, city: CITY.mothman, speed: 9600, doing: "in BASEMENT CRAWL", me: false },
    ] };
    case "callers": return { callers: ["NullPtr", "Vera_9", "mothman", "sysop's cat", "Halcyon", "dot.matrix"].map((h, i) => ({ handle: h, level: LEVEL[h], city: CITY[h], speed: [28800, 14400, 9600, 2400, 14400, 9600][i], created_at: ago(now, 7 + i * 23) })) };
    case "oneliners": return { oneliners: ONELINERS.map(([h, b], i) => ({ id: i + 1, handle: h, level: LEVEL[h], body: b, created_at: ago(now, 300 - i * 40) })) };
    case "wall": return { rows: WALL };
    case "mail": return { unread: 0, rows: [] };
    case "newScan": return { lines: 0, wall: 0, scores: 0, mail: 0, packs: [], first: false, winners: [{ handle: "mothman", score: 4120 }, { handle: "NullPtr", score: 52310 }] };
    case "balance": return { balance: 64 };
    case "shelf": return { rows: [
      { pack: "dc-01", file: "DC-LOGO.ANS", year: 1994, title: "Dead Carrier house logo", artist: "Static / Dead Carrier house crew" },
      { pack: "ansicl01", file: "MOUNTAIN.ANS", year: 1993 },
      { pack: "ensiart", file: "PIANOMAN.ANS", year: 1993 },
      { pack: "ensiart", file: "EARTH.ANS", year: 1993 },
    ] };
    case "cornerStart": return { ok: true, seed: 19931119 };
    case "cornerFinish": case "cornerTop": case "doorTop": return { ok: true, ...scores(now) };
    case "doorTurn": return { ok: true, left: 7 };
    case "view": return { files: 149, speed: 28800, level: "ELITE" };
    case "record": return { level: "ELITE", record: { days: 41, pieces: 149, oneliners: 6, ratings: 22, finishedRuns: 9 }, calls: 212 };
    case "timeBank": case "withdraw": return { remainingSeconds: 3540, banked: 0 };
    case "top": return undefined;
    default: return { ok: true };
  }
}
