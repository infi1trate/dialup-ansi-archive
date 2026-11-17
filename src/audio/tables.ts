// Pure telephony / handshake tables shared by the machine (timing) and the synth (sound).
export const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};
export const DIAL_TONE = [350, 440];
export const RINGBACK = [440, 480];
export const BUSY = [480, 620];
/** Touch tone: 80 ms on, 80 ms off. */
export const DTMF_ON_MS = 80, DTMF_OFF_MS = 80;

/** Handshake length per line speed; the machine waits exactly this long before CONNECT. */
export function handshakeMs(speed: number): number {
  if (speed <= 2400) return 4000;
  if (speed <= 9600) return 6500;
  if (speed <= 14400) return 7500;
  return 9000;
}

/** Two-digit case display: the 486DX-33 shows 33, turbo shows 66. */
export const speedDisplay = (turbo: boolean) => (turbo ? "66" : "33");
