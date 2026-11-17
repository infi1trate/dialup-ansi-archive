// Room + escape-hatch settings, persisted in localStorage. Read only from effects/handlers.
export interface RoomSettings {
  muted: boolean;
  /** null = follow the OS preference */
  reducedMotion: boolean | null;
  lamp: boolean;
  /** null = choose from the viewport (narrow/portrait starts leaned in) */
  lean: boolean | null;
  brightness: number; // 0..1
  contrast: number; // 0..1
  modemVolume: number; // 0..1
  musicVolume: number; // 0..1, desk speakers
  turbo: boolean;
}
const KEY = "dialup.room.v1";
export const DEFAULTS: RoomSettings = { muted: false, reducedMotion: null, lamp: false, lean: null, brightness: 0.6, contrast: 0.7, modemVolume: 0.6, musicVolume: 0.6, turbo: false };

export function loadRoom(): RoomSettings {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<RoomSettings>) }; }
  catch { return { ...DEFAULTS }; }
}
export function saveRoom(s: RoomSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

/** Knob value -> CRT multipliers. */
export const brightnessGain = (v: number) => 0.6 + v * 0.65;
export const contrastGain = (v: number) => 0.7 + v * 0.55;
