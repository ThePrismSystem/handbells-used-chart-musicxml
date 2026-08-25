import { describe, expect, it } from "vitest";

import { resolveBells } from "./resolve.js";

import type { OctaveConvention, RawNote } from "./types.js";

const note = (partId: string, octave: number): RawNote => ({
  pitch: { step: "C", alter: 0, octave },
  notehead: "normal",
  partId,
});

describe("resolveBells", () => {
  it("raises a written-octave-below part by one octave", () => {
    // MusicXML stores written pitch; a bell's name is written pitch plus an
    // octave when the part follows handbell convention.
    const conventions = new Map<string, OctaveConvention>([["P1", "written-octave-below"]]);
    const [bell] = resolveBells([note("P1", 4)], conventions);
    expect(bell?.pitch.octave).toBe(5);
    expect(bell?.midi).toBe(72);
  });

  it("leaves an at-bell-name part where it is", () => {
    const conventions = new Map<string, OctaveConvention>([["P1", "at-bell-name"]]);
    const [bell] = resolveBells([note("P1", 5)], conventions);
    expect(bell?.pitch.octave).toBe(5);
    expect(bell?.midi).toBe(72);
  });

  it("applies each part's own convention", () => {
    const conventions = new Map<string, OctaveConvention>([
      ["P1", "written-octave-below"],
      ["P2", "at-bell-name"],
    ]);
    const bells = resolveBells([note("P1", 4), note("P2", 4)], conventions);
    expect(bells.map((b) => b.pitch.octave)).toEqual([5, 4]);
  });

  it("falls back to handbell convention for a part with no entry", () => {
    // Most handbell music follows the convention; assuming it is the least
    // surprising default for a part the reader could not classify.
    const [bell] = resolveBells([note("P9", 4)], new Map());
    expect(bell?.pitch.octave).toBe(5);
  });

  it("carries the notehead through untouched", () => {
    const raw: RawNote = {
      pitch: { step: "G", alter: 1, octave: 4 },
      notehead: "la",
      partId: "P1",
    };
    const [bell] = resolveBells([raw], new Map());
    expect(bell?.notehead).toBe("la");
    expect(bell?.pitch).toEqual({ step: "G", alter: 1, octave: 5 });
  });
});
