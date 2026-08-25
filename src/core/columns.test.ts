import { describe, expect, it } from "vitest";

import { buildColumns } from "./columns.js";
import { regionOf, toMidi, toName } from "./pitch.js";

import type { ChartEntry, Pitch } from "./types.js";

const entry = (step: Pitch["step"], alter: Pitch["alter"], octave: number): ChartEntry => {
  const pitch: Pitch = { step, alter, octave };
  const region = regionOf(pitch);
  if (region === null) {
    throw new Error(`${toName(pitch)} is outside the chart`);
  }
  return { pitch, midi: toMidi(pitch), name: toName(pitch), region, count: 1 };
};

const names = (columns: readonly (readonly ChartEntry[])[]): string[][] =>
  columns.map((column) => column.map((e) => e.name));

describe("buildColumns", () => {
  it("stacks treble octaves into one column", () => {
    // D6, D7 and D8 print as one stack.
    const built = buildColumns([entry("D", 0, 6), entry("D", 0, 7), entry("D", 0, 8)]);
    expect(names(built.treble)).toEqual([["D6", "D7", "D8"]]);
  });

  it("does not stack across spellings", () => {
    // G#6 and Ab7 are different bells to a ringer, so they do not share a
    // column even though they are an octave apart in sound.
    const built = buildColumns([entry("G", 1, 6), entry("A", -1, 7)]);
    expect(names(built.treble)).toEqual([["G#6"], ["Ab7"]]);
  });

  it("gives an orphan octave its own column, ordered as though its anchor existed", () => {
    // C8 has no C7 to attach to; it still sorts where C7 would have sat.
    const built = buildColumns([entry("E", 0, 6), entry("C", 0, 8), entry("F", 0, 6)]);
    expect(names(built.treble)).toEqual([["E6"], ["F6"], ["C8"]]);
  });

  it("puts the low bass block ahead of the staff bells", () => {
    const built = buildColumns([entry("C", 0, 4), entry("G", 0, 3), entry("G", 0, 2)]);
    expect(names(built.bass)).toEqual([["G2", "G3"], ["C4"]]);
  });

  it("gives each bass staff bell its own column", () => {
    const built = buildColumns([entry("C", 0, 4), entry("E", 0, 4), entry("C", 0, 5)]);
    expect(names(built.bass)).toEqual([["C4"], ["E4"], ["C5"]]);
  });

  it("orders bass staff bells ascending whatever order they arrive in", () => {
    const built = buildColumns([entry("E", 0, 4), entry("C", 0, 4)]);
    expect(names(built.bass)).toEqual([["C4"], ["E4"]]);
  });

  it("sorts the notes within a column ascending", () => {
    const built = buildColumns([entry("D", 0, 8), entry("D", 0, 6)]);
    expect(names(built.treble)).toEqual([["D6", "D8"]]);
  });

  it("reports the wider of the two staves as its length", () => {
    const built = buildColumns([entry("C", 0, 4), entry("E", 0, 4), entry("D", 0, 6)]);
    expect(built.bass).toHaveLength(2);
    expect(built.treble).toHaveLength(1);
    expect(built.length).toBe(2);
  });

  it("returns empty staves for no entries", () => {
    const built = buildColumns([]);
    expect(built).toEqual({ treble: [], bass: [], length: 0 });
  });
});
