import { describe, expect, it } from "vitest";
import { CLIENT_STEPS, FUNNEL } from "@/lib/filter";

describe("sharing counters", () => {
  it("counts postcards, tapes, bills and promotions", () => {
    for (const s of ["postcard_sent", "postcard_opened", "postcard_skipped", "postcard_replied", "postcard_entered", "tape_recorded", "bill_printed", "promoted", "called_back"]) expect(FUNNEL).toContain(s);
  });
  it("browsers may report only tapes and bill prints, never postcard or promotion counts", () => {
    expect(CLIENT_STEPS).toContain("tape_recorded"); expect(CLIENT_STEPS).toContain("bill_printed");
    for (const s of ["postcard_sent", "postcard_opened", "postcard_entered", "promoted", "called_back"]) expect(CLIENT_STEPS as readonly string[]).not.toContain(s);
  });
});
