// The contract between the virtual host (the board) and the caller's machine.
// The board only writes bytes (through the modem) and reads keys. Client-side
// terminal features (mode, scrollback, local overlay) are TELEWIRE functions.
import type { Key } from "@/machine/keyboard";
import type { Profile } from "@/machine/storage";
import type { TermMode } from "@/term/terminal";

export type BoardMode = "archive" | "groups" | "year1993" | "later" | "void";
export interface DirEntry { id: string; name: string; number: string; mode: BoardMode; blurb: string; years: [number, number]; hidden?: boolean }

/** Files a caller must view before The Attic appears in the phone book. */
export const ATTIC_UNLOCK = 10;

export const DIRECTORY: DirEntry[] = [
  { id: "crawl", name: "The Crawlspace BBS", number: "555-0142", mode: "archive", blurb: "whole archive, 1990-1996", years: [1990, 1996] },
  { id: "vault", name: "Group Vault", number: "555-0167", mode: "groups", blurb: "browse by group first", years: [1990, 1996] },
  { id: "c93", name: "Class of '93", number: "555-0193", mode: "year1993", blurb: "1993 only", years: [1993, 1993] },
  { id: "attic", name: "The Attic", number: "555-0199", mode: "later", blurb: "1997 to the present", years: [1997, 2100] },
  { id: "void", name: "VOID//NODE", number: "555-0113", mode: "void", blurb: "", years: [1990, 2100], hidden: true },
];

/** The phone book as this caller sees it: The Attic only after ATTIC_UNLOCK files; VOID//NODE never. */
export function phoneBook(filesSeen: number): DirEntry[] {
  return DIRECTORY.filter((d) => !d.hidden && (d.id !== "attic" || filesSeen >= ATTIC_UNLOCK));
}
/** Normalize typed digits ("5550113", "555 0113") to "555-0113". */
export function normalizeNumber(s: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 4) return `555-${d}`;
  return null;
}
export function boardAt(number: string): DirEntry | undefined { return DIRECTORY.find((d) => d.number === number); }

/** A key the current screen accepts: label shown on the keycap, key sent when tapped. `text` = summon the OS keyboard. */
export interface KeyHint { label: string; key: string; ch?: string; text?: boolean }

export interface DeepLink { year: number; pack: string; file: string }

export interface HostIO {
  send(data: Uint8Array): void;
  key(): Promise<Key>;
  /** Next key, or null once all queued output has been delivered. */
  keyOrDrain(): Promise<Key | null>;
  drain(): Promise<void>;
  /** Next key, or null after `ms`. */
  keyTimeout(ms: number): Promise<Key | null>;
  /** Out-of-band: the keys this screen accepts (touch context bar). Never part of the byte stream. */
  hint(keys: KeyHint[]): void;
  flush(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  /** Drop undelivered output (the user aborted a transfer). */
  clearOutput(): void;
  client: {
    setMode(m: Partial<TermMode>): void;
    scroll(delta: number): void;
    scrollTo(where: "top" | "bottom"): void;
    markTop(): void;
    overlay(bytes: Uint8Array | null): void;
    rows(): number;
    /** A piece is on screen (TELEWIRE shows "turn your phone" in portrait). */
    artOpen(on: boolean): void;
  };
  speed: number;
  node: number;
  entry: DirEntry;
  profile: Profile;
  save(): void;
  timeLeftMs(): number;
  deepLink?: DeepLink;
}
