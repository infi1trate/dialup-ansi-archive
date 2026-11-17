export interface PackSummary { name: string; year: number; groups: string[] }
export interface PackFile { name: string; artists: string[]; size: number | null; viewable: boolean }
export interface PackInfo { name: string; year: number; groups: string[]; files: PackFile[]; fileId: string | null; house?: boolean }
export interface Page<T> { items: T[]; page: number; pages: number; total: number }
export interface GroupSummary { name: string; releases: number }

export const VIEWABLE = /\.(ans|asc|ice|diz|nfo|txt|bin|xb|adf|idf)$/i;
export function isViewable(name: string) { return VIEWABLE.test(name); }
