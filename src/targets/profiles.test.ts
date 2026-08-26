import { describe, expect, it } from "vitest";

import { DORICO, GENERIC, TARGETS, targetById } from "./profiles.js";

describe("profiles", () => {
  it("ships Dorico as the default target", () => {
    expect(TARGETS[0]).toBe(DORICO);
  });

  it("gives every target a unique id", () => {
    expect(new Set(TARGETS.map((t) => t.id)).size).toBe(TARGETS.length);
  });

  it("starts Dorico on the one-measure, clef-only settings", () => {
    // These are the defaults going in; the manual Dorico gate confirms or
    // flips each one.
    expect(DORICO.columnsPerMeasure).toBe("all");
    expect(DORICO.octaveVia).toBe("clef");
    expect(DORICO.hideChartStavesAfterChart).toBe(true);
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
