// Positions of everything in the shot, in cqw of the 16:9 stage (stage = 100 x 56.25).
// Objects and their emissive parts (LEDs, digits) share these numbers so they line up.
export const STAGE_H = 56.25;
export const MONITOR = { x: 22, w: 50, bottom: 46.2 };
export const CASE = { x: 18.5, y: 46, w: 57, h: 7 };
export const MODEM = { x: 78.5, y: 48.2, w: 16.5, h: 3.6 };
export const CLOCK = { x: 2.6, y: 45.6, w: 9.6, h: 4.0 };
export const LAMP = { x: -3.2, y: 17.8, w: 22.5, h: 30 };
export const WINDOW = { x: 0.4, y: 0.2, w: 13.4, h: 10.6 };
export const JACK = { x: 97.4, y: 37.5, w: 1.5, h: 2.2 };
export const KEYBOARD = { x: 22, y: 53.3, w: 50, h: 9 };

/** Front-panel parts of the case, in % of the case box. */
export const CASE_PARTS = {
  display: { x: 31.5, y: 18, w: 6.4, h: 44 },
  powerLed: { x: 32.2, y: 74 },
  hddLed: { x: 35.6, y: 74 },
  turbo: { x: 40.5, y: 20, w: 4.2, h: 24 },
  reset: { x: 40.5, y: 56, w: 4.2, h: 20 },
  rocker: { x: 91.5, y: 28, w: 5, h: 46 },
};
export const MODEM_LEDS = ["HS", "AA", "CD", "OH", "RD", "SD", "TR", "MR"] as const;
export const modemLedX = (i: number) => 30 + i * 7.6; // % of modem width
export const MODEM_LED_Y = 40; // % of modem height

/** Convert a part position inside a box to stage cqw. */
export const inBox = (box: { x: number; y: number; w: number; h: number }, px: number, py: number) =>
  ({ x: box.x + (box.w * px) / 100, y: box.y + (box.h * py) / 100 });
