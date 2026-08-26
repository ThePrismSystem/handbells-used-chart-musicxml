import { describe, expect, it } from "vitest";

import { DORICO, GENERIC, TARGETS, targetById } from "./profiles.js";

describe("profiles", () => {
  it("ships Dorico as the default target", () => {
    expect(TARGETS[0]).toBe(DORICO);
  });

  it("gives every target a unique id", () => {
    expect(new Set(TARGETS.map((t) => t.id)).size).toBe(TARGETS.length);
  });

  it("carries the two settings the Dorico gate measured", () => {
    // Measured against Dorico, not chosen. With a whole chart in one bar
    // Dorico prints its own naturals to cancel accidentals earlier in that
    // bar, and it draws the chart staves on after the chart whatever
    // <staff-details print-object="no"> asks for.
    expect(DORICO.columnsPerMeasure).toBe(1);
    expect(DORICO.hideChartStavesAfterChart).toBe(false);
  });

  it("leaves the settings the gate did not settle where they started", () => {
    expect(DORICO.octaveVia).toBe("clef");
    expect(DORICO.chartStaffSizePercent).toBe(80);
  });

  it("keeps the generic target free of application-specific hints", () => {
    expect(GENERIC.chartStaffSizePercent).toBeNull();
  });

  it("looks a target up by id", () => {
    expect(targetById("dorico")).toBe(DORICO);
    // Dorico is also the fallback, so looking Dorico up proves nothing on its
    // own: `return DORICO` would satisfy it and every other case below.
    // Only a non-fallback target shows that the lookup runs at all.
    expect(targetById("generic")).toBe(GENERIC);
  });

  it("falls back to Dorico for an unknown id", () => {
    expect(targetById("nonsense")).toBe(DORICO);
  });
});
