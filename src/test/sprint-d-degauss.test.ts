import { describe, expect, it } from "vitest";
import { DegaussCoil, DEGAUSS_RECHARGE_MS, degaussEnvelope } from "@/lib/degauss";

describe("degauss coil", () => {
  it("needs 20 seconds to recharge: early presses only click", () => {
    const c = new DegaussCoil();
    expect(c.press(1000, true)).toBe("degauss");
    expect(c.press(1000 + 5_000, true)).toBe("click");
    expect(c.press(1000 + DEGAUSS_RECHARGE_MS - 1, true)).toBe("click");
    expect(c.press(1000 + DEGAUSS_RECHARGE_MS, true)).toBe("degauss");
  });
  it("does nothing while the monitor is off, and an off press does not use the charge", () => {
    const c = new DegaussCoil();
    expect(c.press(0, false)).toBe("none");
    expect(c.press(10, true)).toBe("degauss");
    expect(c.press(20, false)).toBe("none");
  });
  it("the wobble settles by 1.6 seconds", () => {
    expect(degaussEnvelope(0.1)).toBeGreaterThan(0.5);
    expect(degaussEnvelope(1.6)).toBe(0);
  });
});
