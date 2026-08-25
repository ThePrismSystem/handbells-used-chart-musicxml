import { describe, expect, it } from "vitest";

import { DEFAULT_HEAD_MAPPING } from "./collect.js";
import { toMidi } from "./pitch.js";
import { buildPlan, readRanges } from "./plan.js";

import type { PlanOptions } from "./plan.js";
import type { BellRecord, Pitch } from "./types.js";

const bell = (
  step: Pitch["step"],
  alter: Pitch["alter"],
  octave: number,
  notehead = "normal",
): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead };
};

const options = (extra: Partial<PlanOptions> = {}): PlanOptions => ({
  headMapping: DEFAULT_HEAD_MAPPING,
  ...extra,
});

describe("buildPlan", () => {
  it("emits no section for a kind the score does not use", () => {
    const plan = buildPlan([bell("C", 0, 5)], options());
    expect(plan.sections.map((s) => s.kind)).toEqual(["bells"]);
  });

  it("orders sections bells, chimes, then silver melody bells", () => {
    const plan = buildPlan(
      [bell("E", 0, 6, "la"), bell("D", 0, 6, "diamond"), bell("C", 0, 5)],
      options(),
    );
    expect(plan.sections.map((s) => s.kind)).toEqual(["bells", "chimes", "smbs"]);
  });

  it("counts physical bells in the label, so two spellings count once", () => {
    const plan = buildPlan([bell("G", 1, 5), bell("A", -1, 5)], options());
    expect(plan.sections[0]?.label).toBe("Handbells Used: 1");
  });

  it("lets a custom label replace the whole generated one", () => {
    // Someone who writes their own wording says everything they want said.
    const plan = buildPlan([bell("C", 0, 5)], options({ bellLabel: "Bells you need" }));
    expect(plan.sections[0]?.label).toBe("Bells you need");
  });

  it("marks the silver melody bell label optional when asked", () => {
    const plan = buildPlan([bell("E", 0, 6, "la")], options({ smbsOptional: true }));
    expect(plan.sections[0]?.label).toBe("SMBs Used: 1 (optional)");
  });

  it("does not append the marker to a custom label", () => {
    const plan = buildPlan(
      [bell("E", 0, 6, "la")],
      options({ smbLabel: "Chimes of silver", smbsOptional: true }),
    );
    expect(plan.sections[0]?.label).toBe("Chimes of silver");
  });

  it("gives silver melody bells one staff and the others two", () => {
    const plan = buildPlan([bell("C", 0, 5), bell("E", 0, 6, "la")], options());
    expect(plan.sections.map((s) => s.staves)).toEqual([2, 1]);
  });

  it("draws the canonical notehead for each kind", () => {
    // The input mapping is configurable; the chart is a legend written to
    // published convention.
    const mapping = new Map(DEFAULT_HEAD_MAPPING).set("x", "chimes");
    const plan = buildPlan([bell("D", 0, 6, "x")], options({ headMapping: mapping }));
    expect(plan.sections[0]?.notehead).toBe("diamond");
  });

  it("normalises the colour it carries", () => {
    const plan = buildPlan([bell("D", 0, 6, "diamond")], options({ chimeColor: "#c00000" }));
    expect(plan.sections[0]?.color).toBe("#C00000");
  });

  it("reports ignored noteheads", () => {
    const plan = buildPlan([bell("C", 0, 5), bell("D", 0, 6, "triangle")], options());
    expect(plan.warnings).toContainEqual({ type: "ignored-notehead", count: 1 });
  });

  it("reports out-of-range bells and silver melody bells separately", () => {
    const plan = buildPlan([bell("D", 0, 9), bell("B", 0, 4, "la")], options());
    expect(plan.warnings).toContainEqual({ type: "out-of-range", names: ["D9"] });
    expect(plan.warnings).toContainEqual({ type: "smb-out-of-range", names: ["B4"] });
  });

  it("emits no warnings when nothing was left off", () => {
    expect(buildPlan([bell("C", 0, 5)], options()).warnings).toEqual([]);
  });

  it("reports the column count of the wider staff", () => {
    const plan = buildPlan([bell("C", 0, 4), bell("E", 0, 4), bell("D", 0, 6)], options());
    expect(plan.sections[0]?.columns).toBe(2);
  });

  it("gives silver melody bells no optional runs", () => {
    // The whole set is optional or none of it is, so the marker goes on the
    // label rather than bracketing columns.
    const plan = buildPlan(
      [bell("E", 0, 6, "la")],
      options({ requiredBellFirst: "C6", smbsOptional: true }),
    );
    expect(plan.sections[0]?.optional).toEqual([]);
  });
});

describe("readRanges", () => {
  it("parses both ranges whatever the score contains", () => {
    // A mistyped chime name on a bells-only score must not be silently
    // ignored, or the user is never told why the range they set did nothing.
    expect(() =>
      readRanges({ headMapping: DEFAULT_HEAD_MAPPING, requiredChimeFirst: "H4" }),
    ).toThrow(/not a chime name/);
  });

  it("returns open ranges when nothing is set", () => {
    expect(readRanges({ headMapping: DEFAULT_HEAD_MAPPING })).toEqual({
      bells: { first: null, last: null },
      chimes: { first: null, last: null },
    });
  });
});
