import { describe, expect, it } from "vitest";

import { buildColumns } from "./columns.js";
import { isAbove, optionalRuns, spanColumns, wordColumn } from "./optional.js";
import { regionOf, toMidi, toName } from "./pitch.js";
import { bellRange } from "./range.js";

import type { ChartEntry, Pitch } from "./types.js";

const entry = (step: Pitch["step"], alter: Pitch["alter"], octave: number): ChartEntry => {
  const pitch: Pitch = { step, alter, octave };
  const region = regionOf(pitch);
  if (region === null) {
    throw new Error(`${toName(pitch)} is outside the chart`);
  }
  return { pitch, midi: toMidi(pitch), name: toName(pitch), region, count: 1 };
};

describe("optionalRuns", () => {
  it("finds no run when nothing falls outside", () => {
    const built = buildColumns([entry("D", 0, 6), entry("E", 0, 6)]);
    expect(optionalRuns(built, bellRange("C5", "C8"))).toEqual([]);
  });

  it("finds no run when the range has no ends", () => {
    const built = buildColumns([entry("D", 0, 6)]);
    expect(optionalRuns(built, bellRange(null, null))).toEqual([]);
  });

  it("starts at the first optional column, not the first column", () => {
    // A run is one bracket per staff, which is what published charts draw.
    const built = buildColumns([entry("D", 0, 7), entry("E", 0, 7), entry("F", 0, 7)]);
    expect(optionalRuns(built, bellRange(null, "D7"))).toEqual([
      { staff: "treble", firstColumn: 1, lastColumn: 2 },
    ]);
  });

  it("keeps a required column inside the run when optional ones sit either side", () => {
    // One bracket per staff: a required bell between two optional ones stays
    // under the bracket. A contiguous-block scan would emit two runs here.
    const built = buildColumns([entry("D", 0, 7), entry("E", 0, 7), entry("F", 0, 7)]);
    expect(optionalRuns(built, bellRange("E7", "E7"))).toEqual([
      { staff: "treble", firstColumn: 0, lastColumn: 2 },
    ]);
  });

  it("counts a column optional when any bell in it is", () => {
    // A treble column can hold a required staff bell with an optional octave
    // stacked above it; the bracket covers that column.
    const built = buildColumns([entry("D", 0, 6), entry("D", 0, 8)]);
    expect(built.treble).toHaveLength(1);
    expect(optionalRuns(built, bellRange(null, "C7"))).toEqual([
      { staff: "treble", firstColumn: 0, lastColumn: 0 },
    ]);
  });

  it("reports treble and bass runs separately", () => {
    const built = buildColumns([entry("G", 0, 2), entry("C", 0, 4), entry("D", 0, 8)]);
    const runs = optionalRuns(built, bellRange("C4", "C7"));
    expect(runs.map((r) => r.staff)).toEqual(["treble", "bass"]);
  });
});

describe("run geometry", () => {
  it("reports zero span for a one-column run", () => {
    // A one-column run draws no line at all — the word alone marks that bell.
    expect(spanColumns({ staff: "treble", firstColumn: 2, lastColumn: 2 })).toBe(0);
  });

  it("reports the distance across for a wider run", () => {
    expect(spanColumns({ staff: "treble", firstColumn: 1, lastColumn: 4 })).toBe(3);
  });

  it("centres the word, flooring an even-length run to the earlier column", () => {
    expect(wordColumn({ staff: "treble", firstColumn: 0, lastColumn: 3 })).toBe(1);
    expect(wordColumn({ staff: "treble", firstColumn: 0, lastColumn: 4 })).toBe(2);
  });

  it("puts the treble run above the staff and the bass run below", () => {
    expect(isAbove({ staff: "treble", firstColumn: 0, lastColumn: 1 })).toBe(true);
    expect(isAbove({ staff: "bass", firstColumn: 0, lastColumn: 1 })).toBe(false);
  });
});
