import { describe, expect, it } from "vitest";

import { SMB_COMPASS, addOctaves, diatonic, parseName, regionOf, toMidi, toName } from "./pitch.js";

import type { Pitch } from "./types.js";

const p = (step: Pitch["step"], alter: Pitch["alter"], octave: number): Pitch => ({
  step,
  alter,
  octave,
});

describe("toMidi", () => {
  it("puts middle C at 60", () => {
    expect(toMidi(p("C", 0, 4))).toBe(60);
  });

  it("applies the alteration", () => {
    expect(toMidi(p("G", 1, 5))).toBe(80);
    expect(toMidi(p("A", -1, 5))).toBe(80);
  });

  it("keeps Cb in its own octave rather than the one below", () => {
    // Cb5 sounds a semitone below C5, but it is spelled as a C and belongs to
    // octave 5. The octave is part of the spelling, not derived from the sound.
    expect(toMidi(p("C", -1, 5))).toBe(71);
    expect(toName(p("C", -1, 5))).toBe("Cb5");
  });
});

describe("toName", () => {
  it("writes each accidental the way a chart prints it", () => {
    expect(toName(p("C", 0, 6))).toBe("C6");
    expect(toName(p("A", -1, 3))).toBe("Ab3");
    expect(toName(p("F", 1, 7))).toBe("F#7");
    expect(toName(p("B", -2, 2))).toBe("Bbb2");
    expect(toName(p("D", 2, 5))).toBe("Dx5");
  });
});

describe("parseName", () => {
  it("round-trips every accidental", () => {
    for (const name of ["C6", "Ab3", "F#7", "Bbb2", "Dx5"]) {
      expect(toName(parseName(name))).toBe(name);
    }
  });

  it("accepts a lower-case letter", () => {
    expect(toName(parseName("c6"))).toBe("C6");
  });

  it("does not fold the accidental's case", () => {
    // "B" and "b" are a letter and a flat; folding would make "Bb" ambiguous.
    expect(() => parseName("BB2")).toThrow(/not a bell name/);
  });

  it("refuses a trailing character that is not an octave", () => {
    expect(() => parseName("C5x")).toThrow(/not a bell name/);
  });

  it("refuses a negative octave", () => {
    expect(() => parseName("C-1")).toThrow(/not a bell name/);
  });

  it("refuses empty and non-string input", () => {
    expect(() => parseName("")).toThrow(/not a bell name/);
    expect(() => parseName("   ")).toThrow(/not a bell name/);
  });

  it("names the noun it was asked for", () => {
    expect(() => parseName("H4", "chime")).toThrow(/not a chime name/);
  });
});

describe("diatonic", () => {
  it("ignores the accidental", () => {
    expect(diatonic(p("C", 0, 2))).toBe(14);
    expect(diatonic(p("C", 1, 2))).toBe(14);
    expect(diatonic(p("B", 0, 2))).toBe(20);
  });
});

describe("regionOf", () => {
  it("places each region boundary", () => {
    expect(regionOf(p("C", 0, 2))).toBe("bassRow2");
    expect(regionOf(p("B", 0, 2))).toBe("bassRow2");
    expect(regionOf(p("C", 0, 3))).toBe("bassRow1");
    expect(regionOf(p("B", 0, 3))).toBe("bassRow1");
    expect(regionOf(p("C", 0, 4))).toBe("bassStaff");
    expect(regionOf(p("C", 0, 5))).toBe("bassStaff");
    expect(regionOf(p("D", 0, 5))).toBe("trebleStaff");
    expect(regionOf(p("C", 0, 7))).toBe("trebleStaff");
    expect(regionOf(p("D", 0, 7))).toBe("trebleRow1");
    expect(regionOf(p("C", 0, 8))).toBe("trebleRow1");
    expect(regionOf(p("D", 0, 8))).toBe("trebleRow2");
    expect(regionOf(p("C", 0, 9))).toBe("trebleRow2");
  });

  it("returns null outside C2 to C9", () => {
    expect(regionOf(p("B", 0, 1))).toBeNull();
    expect(regionOf(p("D", 0, 9))).toBeNull();
  });
});

describe("addOctaves", () => {
  it("moves the octave and leaves the spelling alone", () => {
    expect(addOctaves(p("G", 1, 4), 1)).toEqual(p("G", 1, 5));
    expect(addOctaves(p("G", 1, 4), -1)).toEqual(p("G", 1, 3));
  });
});

describe("SMB_COMPASS", () => {
  it("spans C5 to C7 and nothing else", () => {
    // Silver melody bells are made in one size only.
    expect(SMB_COMPASS.min).toBe(toMidi(p("C", 0, 5)));
    expect(SMB_COMPASS.max).toBe(toMidi(p("C", 0, 7)));
  });
});
