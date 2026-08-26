import { describe, expect, it } from "vitest";

import { DORICO, GENERIC, TARGETS, targetById } from "./profiles.js";

describe("profiles", () => {
  it("ships Dorico as the default target", () => {
    expect(TARGETS[0]).toBe(DORICO);
  });

  it("gives every target a unique id", () => {
    expect(new Set(TARGETS.map((t) => t.id)).size).toBe(TARGETS.length);
  });

  it("carries the settings the Dorico gate measured", () => {
    // Measured against Dorico, not chosen. It draws the chart staves on after
    // the chart whatever <staff-details print-object="no"> asks for, ignores
    // <staff-size>, and lowers a notehead by the clef's octave change — so it
    // is handed the bell's own pitch rather than the written one. One column
    // per bar does not stop Dorico restating a cancelling natural, but it
    // moves that restatement into a rule the reader can switch off.
    expect(DORICO.columnsPerMeasure).toBe(1);
    expect(DORICO.hideChartStavesAfterChart).toBe(false);
    expect(DORICO.chartStaffSizePercent).toBeNull();
    expect(DORICO.writtenOctaveShift).toBe(0);
  });

  it("keeps the generic target on MusicXML's own reading of pitch", () => {
    // <pitch> is the written pitch, so the bell is written an octave below its
    // name and the 8va clef names it back. Unverified against any one
    // application, which is what makes it the generic target rather than one.
    expect(GENERIC.writtenOctaveShift).toBe(-1);
    expect(GENERIC.octaveVia).toBe("clef");
  });

  it("leaves the one setting the gate did not reach where it started", () => {
    expect(DORICO.octaveVia).toBe("clef");
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
