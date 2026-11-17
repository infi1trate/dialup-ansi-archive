// The contract between the virtual host (the board) and the caller's machine.
// The board only writes bytes (through the modem) and reads keys. Client-side
// terminal features (mode, scrollback, local overlay) are TELEWIRE functions.
import type { Key } from "@/machine/keyboard";
import type { Profile } from "@/machine/storage";
import type { TermMode } from "@/term/terminal";

export interface DirEntry { id: string; name: string; number: string; mode: "archive" | "groups" | "year1993"; blurb: string }

export const DIRECTORY: DirEntry[] = [
  { id: "crawl", name: "The Crawlspace BBS", number: "555-0142", mode: "archive", blurb: "whole archive, 1990-1996" },
  { id: "vault", name: "Group Vault", number: "555-0167", mode: "groups", blurb: "browse by group first" },
  { id: "c93", name: "Class of '93", number: "555-0193", mode: "year1993", blurb: "1993 only" },
];

export interface DeepLink { year: number; pack: string; file: string }

export interface HostIO {
  send(data: Uint8Array): void;
  key(): Promise<Key>;
  /** Next key, or null once all queued output has been delivered. */
  keyOrDrain(): Promise<Key | null>;
  drain(): Promise<void>;
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
  };
  speed: number;
  node: number;
  entry: DirEntry;
  profile: Profile;
  save(): void;
  timeLeftMs(): number;
  deepLink?: DeepLink;
}
