import { describe, expect, it } from "vitest";

import { detectConvention } from "./detect.js";

import type { PartSignals } from "./detect.js";

const signals = (extra: Partial<PartSignals> = {}): PartSignals => ({
  id: "P1",
  name: "Piano",
  instrumentSound: null,
  octaveChange: null,
  ...extra,
});

describe("detectConvention", () => {
  it("trusts a handbell instrument that carries its transposition", () => {
    const result = detectConvention(
      signals({ instrumentSound: "pitched-percussion.handbells", octaveChange: 1 }),
    );
    expect(result.convention).toBe("written-octave-below");
    expect(result.reason).toContain("pitched-percussion.handbells");
  });

  it("recognises handchimes the same way", () => {
    const result = detectConvention(
      signals({ instrumentSound: "pitched-percussion.handchimes", octaveChange: 1 }),
    );
    expect(result.convention).toBe("written-octave-below");
    // The convention alone cannot fail this test: it is what every branch
    // below returns too. Only the reason proves the handchimes sound matched.
    expect(result.reason).toContain("pitched-percussion.handchimes");
  });

  it("reads a handbell part with no transpose as already sounding", () => {
    // A handbell instrument exported without its transposition has pitches
    // that are already bell names.
    const result = detectConvention(signals({ instrumentSound: "pitched-percussion.handbells" }));
    expect(result.convention).toBe("at-bell-name");
    expect(result.reason).toContain("no <transpose>");
  });

  it("uses an octave transposition on its own", () => {
    const result = detectConvention(signals({ octaveChange: 1 }));
    expect(result.convention).toBe("written-octave-below");
    expect(result.reason).toContain("<transpose>");
  });

  it("falls back to the part name", () => {
    const result = detectConvention(signals({ name: "Handbells 3-5 octaves" }));
    expect(result.convention).toBe("written-octave-below");
    expect(result.reason).toContain("Handbells 3-5 octaves");
  });

  it("matches a spaced or hyphenated part name", () => {
    for (const name of ["Hand Bells", "hand-chimes", "Handchimes"]) {
      const result = detectConvention(signals({ name }));
      expect(result.convention).toBe("written-octave-below");
      // Deleting HANDBELL_NAME entirely would leave the convention assertion
      // passing, since the no-signal fallback returns the same value. The
      // reason is the only thing that distinguishes the two.
      expect(result.reason).toContain(name);
    }
  });

  it("assumes handbell convention when nothing signals", () => {
    // Most handbell music was and still is written on a Piano part.
    const result = detectConvention(signals());
    expect(result.convention).toBe("written-octave-below");
    expect(result.reason).toContain("no signal");
  });

  it("ignores an unrelated instrument sound", () => {
    const result = detectConvention(signals({ instrumentSound: "keyboard.piano" }));
    expect(result.convention).toBe("written-octave-below");
    expect(result.reason).toContain("no signal");
  });
});
