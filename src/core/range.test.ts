import { describe, expect, it } from "vitest";

import { toMidi } from "./pitch.js";
import { bellRange, isOptional } from "./range.js";

describe("bellRange", () => {
  it("converts names to sounding pitch", () => {
    const range = bellRange("C5", "C8");
    expect(range.first).toBe(toMidi({ step: "C", alter: 0, octave: 5 }));
    expect(range.last).toBe(toMidi({ step: "C", alter: 0, octave: 8 }));
  });

  it("treats an unset end as no limit there", () => {
    expect(bellRange("C5", null)).toEqual({ first: 72, last: null });
    expect(bellRange(undefined, "C8")).toEqual({ first: null, last: 108 });
    expect(bellRange("", "  ")).toEqual({ first: null, last: null });
  });

  it("refuses a range that runs backwards", () => {
    expect(() => bellRange("C8", "C5")).toThrow(/sounds above the last/);
  });

  it("names the noun it was asked for", () => {
    expect(() => bellRange("H4", null, "chime")).toThrow(/not a chime name/);
  });
});

describe("isOptional", () => {
  it("marks pitches beyond either end", () => {
    const range = bellRange("C5", "C8");
    expect(isOptional(range, 71)).toBe(true);
    expect(isOptional(range, 72)).toBe(false);
    expect(isOptional(range, 108)).toBe(false);
    expect(isOptional(range, 109)).toBe(true);
  });

  it("marks nothing when both ends are unset", () => {
    const range = bellRange(null, null);
    expect(isOptional(range, 0)).toBe(false);
    expect(isOptional(range, 127)).toBe(false);
  });

  it("does not distinguish spellings of one pitch", () => {
    // G#5 and Ab5 are one bell; a range can never mark one optional and not
    // the other.
    const range = bellRange("A5", null);
    expect(isOptional(range, toMidi({ step: "G", alter: 1, octave: 5 }))).toBe(true);
    expect(isOptional(range, toMidi({ step: "A", alter: -1, octave: 5 }))).toBe(true);
  });
});
