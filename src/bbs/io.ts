// The contract between the virtual host (the board) and the caller's machine.
// The board only writes bytes (through the modem) and reads keys. Client-side
// terminal features (mode, scrollback, local overlay) are TELEWIRE functions.
import type { Key } from "@/machine/keyboard";
import type { Profile } from "@/machine/storage";
import type { TermMode } from "@/term/terminal";

export type BoardMode = "archive" | "groups" | "year1993" | "family" | "music" | "later" | "void";
export interface DirEntry { id: string; name: string; number: string; mode: BoardMode; blurb: string; years: [number, number]; hidden?: boolean }

/** Files a caller must view before The Attic appears in the phone book. */
export const ATTIC_UNLOCK = 10;

export const DIRECTORY: DirEntry[] = [
  { id: "crawl", name: "DEAD CARRIER", number: "555-0142", mode: "archive", blurb: "whole archive, 1990-1996", years: [1990, 1996] },
  { id: "vault", name: "FULL BLOCK", number: "555-0167", mode: "groups", blurb: "browse by group first", years: [1990, 1996] },
  { id: "c93", name: "LINE NOISE", number: "555-0193", mode: "year1993", blurb: "text files and quiet lines", years: [1990, 1996] },
  { id: "maple", name: "MAPLE RIDGE PC USERS GROUP BBS", number: "555-0128", mode: "family", blurb: "club-approved picture shelf", years: [1990, 1996] },
  { id: "strobe", name: "STROBE", number: "555-0177", mode: "music", blurb: "modules, motion and roulette", years: [1990, 1996] },
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
    access?(v:{speed:number;remainingSeconds:number;level:string;exempt?:boolean}):void;
    active?():boolean;
    printBill?(bill:import("@/lib/bill").Bill):Promise<void>;
    /** Out-of-band: offer the modern copy/share control for a link (null hides it). */
    shareLink?(url:string|null):void;
    setMode(m: Partial<TermMode>): void;
    scroll(delta: number): void;
    scrollTo(where: "top" | "bottom"): void;
    markTop(): void;
    overlay(bytes: Uint8Array | null): void;
    rows(): number;
    /** A piece is on screen (TELEWIRE shows "turn your phone" in portrait). */
    artOpen(on: boolean): void | Promise<void>;
    /** TELEWIRE writes a received block to disk (HDD LED, seek sound). */
    disk(): void;
    /** TELEWIRE stores a finished download in C:\DOWNLOAD. */
    saveDownload(f: { name: string; bytes: Uint8Array; pack: string; year: number; file: string; artists: string[]; groups: string[] }): Promise<{ name: string; dropped: string[] } | null>;
    /** Shell out to KPLAY (local program) and come back when it stops. */
    kplay(name: string, bytes: Uint8Array): Promise<void>;
  };
  speed: number;
  node: number;
  entry: DirEntry;
  profile: Profile;
  save(): void;
  timeLeftMs(): number;
  deepLink?: DeepLink;
  /** Arrived from a postcard's [R]/[E] choice. */
  postcardEntry?: { mode: "reply" | "enter"; pack?: string; file?: string; year?: number; replyTo?: string };
}
