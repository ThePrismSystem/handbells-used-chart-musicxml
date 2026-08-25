import { describe, expect, it } from "vitest";

import { DEFAULT_HEAD_MAPPING, collect } from "./collect.js";
import { toMidi } from "./pitch.js";

import type { HeadMapping } from "./collect.js";
import type { BellRecord, ChartKind, Pitch } from "./types.js";

const bell = (
  step: Pitch["step"],
  alter: Pitch["alter"],
  octave: number,
  notehead = "normal",
): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead };
};

describe("collect", () => {
  it("buckets by the default mapping", () => {
    const result = collect(
      [bell("C", 0, 5), bell("D", 0, 6, "diamond"), bell("E", 0, 6, "la")],
      DEFAULT_HEAD_MAPPING,
    );
    expect(result.bells).toHaveLength(1);
    expect(result.chimes).toHaveLength(1);
    expect(result.smbs).toHaveLength(1);
  });

  it("treats a square head as a silver melody bell", () => {
    // A genuinely square head and MuseScore's shape-note La mean the same
    // thing to a ringer.
    const result = collect([bell("E", 0, 6, "square")], DEFAULT_HEAD_MAPPING);
    expect(result.smbs).toHaveLength(1);
  });

  it("honours a custom mapping", () => {
    const mapping: HeadMapping = new Map<string, ChartKind>([["x", "chimes"]]);
    const result = collect([bell("D", 0, 6, "x")], mapping);
    expect(result.chimes).toHaveLength(1);
    expect(result.bells).toHaveLength(0);
  });

  it("counts unmapped noteheads as ignored", () => {
    const result = collect([bell("D", 0, 6, "triangle")], DEFAULT_HEAD_MAPPING);
    expect(result.ignored).toBe(1);
    expect(result.bells).toHaveLength(0);
  });

  it("keeps every spelling that occurs", () => {
    // Ringers read the chart to work out position splits, and a bell shown
    // under one spelling tells the neighbouring position it need not share it.
    const result = collect(
      [bell("G", 1, 5), bell("A", -1, 5), bell("G", 1, 5)],
      DEFAULT_HEAD_MAPPING,
    );
    expect(result.bells.map((e) => e.name)).toEqual(["G#5", "Ab5"]);
    expect(result.bells.map((e) => e.count)).toEqual([2, 1]);
  });

  it("sorts ascending by pitch, then double-sharp through double-flat", () => {
    const result = collect(
      [bell("A", -1, 5), bell("G", 1, 5), bell("C", 0, 5)],
      DEFAULT_HEAD_MAPPING,
    );
    expect(result.bells.map((e) => e.name)).toEqual(["C5", "G#5", "Ab5"]);
  });

  it("names bells outside C2 to C9 rather than charting them", () => {
    const result = collect([bell("B", 0, 1), bell("D", 0, 9)], DEFAULT_HEAD_MAPPING);
    expect(result.bells).toHaveLength(0);
    expect(result.outOfRange).toEqual(["B1", "D9"]);
  });

  it("reports a silver melody bell outside C5 to C7 separately", () => {
    // B4 is an ordinary handbell and a silver melody bell nobody makes, so one
    // message cannot name both the pitch and the limit it broke.
    const result = collect([bell("B", 0, 4, "la")], DEFAULT_HEAD_MAPPING);
    expect(result.smbs).toHaveLength(0);
    expect(result.smbOutOfRange).toEqual(["B4"]);
    expect(result.outOfRange).toEqual([]);
  });

  it("names each out-of-range bell once however often it occurs", () => {
    const result = collect([bell("D", 0, 9), bell("D", 0, 9)], DEFAULT_HEAD_MAPPING);
    expect(result.outOfRange).toEqual(["D9"]);
  });

  it("puts every silver melody bell on the treble staff", () => {
    const result = collect([bell("C", 0, 5, "la"), bell("C", 0, 7, "la")], DEFAULT_HEAD_MAPPING);
    expect(result.smbs.map((e) => e.region)).toEqual(["trebleStaff", "trebleStaff"]);
  });
});
