import { describe, expect, it } from "vitest";
import { DTMF, BUSY, RINGBACK, DIAL_TONE, DTMF_ON_MS, DTMF_OFF_MS, handshakeMs, speedDisplay } from "@/audio/tables";

describe("telephone tones", () => {
  it("uses the correct DTMF pairs", () => {
    expect(DTMF["1"]).toEqual([697, 1209]);
    expect(DTMF["5"]).toEqual([770, 1336]);
    expect(DTMF["9"]).toEqual([852, 1477]);
    expect(DTMF["0"]).toEqual([941, 1336]);
  });
  it("dials 80 ms on, 80 ms off", () => { expect([DTMF_ON_MS, DTMF_OFF_MS]).toEqual([80, 80]); });
  it("dial tone, ringback and busy frequencies", () => {
    expect(DIAL_TONE).toEqual([350, 440]);
    expect(RINGBACK).toEqual([440, 480]);
    expect(BUSY).toEqual([480, 620]);
  });
});

describe("handshake length", () => {
  it("lasts 4-9 s and grows with speed", () => {
    expect(handshakeMs(2400)).toBe(4000);
    expect(handshakeMs(28800)).toBe(9000);
    expect(handshakeMs(9600)).toBeLessThan(handshakeMs(14400));
    expect(handshakeMs(2400)).toBeLessThan(handshakeMs(9600));
  });
});

describe("case speed display", () => {
  it("shows 33 normally and 66 with turbo", () => {
    expect(speedDisplay(false)).toBe("33");
    expect(speedDisplay(true)).toBe("66");
  });
});
