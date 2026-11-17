// Photosensitivity: every blink stays under 3 flashes per second. Reduced motion = steady.
export const TEXT_BLINK_HZ = 1.875; // real VGA: 16 frames on, 16 off at 60 Hz
export const CURSOR_BLINK_HZ = 2.5;  // VGA's 3.75 Hz is above the 3 Hz limit; slowed on purpose
/** true = "on" half of the cycle at time t (s). */
export function blinkPhase(t: number, hz: number, reduced: boolean) {
  if (reduced) return true;
  return Math.floor(t * hz * 2) % 2 === 0;
}
