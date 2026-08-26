import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_HEAD_MAPPING } from "../core/collect.js";
import { toMidi } from "../core/pitch.js";
import { buildPlan } from "../core/plan.js";

import { Summary } from "./Summary.js";

import type { BellRecord, Pitch } from "../core/types.js";

const bell = (
  step: Pitch["step"],
  alter: Pitch["alter"],
  octave: number,
  notehead = "normal",
): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead };
};

describe("Summary", () => {
  it("lists the bells in chart order", () => {
    const plan = buildPlan([bell("G", 1, 5), bell("C", 0, 5)], {
      headMapping: DEFAULT_HEAD_MAPPING,
    });
    // Asserted against the container's text rather than with getByText,
    // because the two bells will sit in separate elements: a cross-element
    // regex makes getByText match the row, its list and every ancestor, and
    // it throws "found multiple elements". The point here is the ORDER —
    // C5 before G#5 though they were supplied the other way round — and
    // container text pins that without constraining the markup.
    const { container } = render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    expect(container.textContent).toMatch(/C5.*G#5/s);
  });

  it("shows each section's label as a heading", () => {
    const plan = buildPlan([bell("C", 0, 5)], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    expect(screen.getByRole("heading", { name: "Handbells Used: 1" })).toBeInTheDocument();
  });

  it("renders warnings as text, never colour alone", () => {
    const plan = buildPlan([bell("D", 0, 9), bell("C", 0, 5)], {
      headMapping: DEFAULT_HEAD_MAPPING,
    });
    render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    expect(screen.getByText(/D9/)).toBeInTheDocument();
    expect(screen.getByText(/outside/i)).toBeInTheDocument();
  });

  it("says when an existing chart will be replaced", () => {
    const plan = buildPlan([bell("C", 0, 5)], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<Summary plan={plan} hasExistingChart unreadable={0} />);
    expect(screen.getByText(/already has a chart/i)).toBeInTheDocument();
  });

  it("reports unreadable notes", () => {
    const plan = buildPlan([bell("C", 0, 5)], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<Summary plan={plan} hasExistingChart={false} unreadable={3} />);
    expect(screen.getByText(/3 notes/i)).toBeInTheDocument();
  });

  it("says so when nothing would be charted", () => {
    const plan = buildPlan([], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    expect(screen.getByText(/nothing to chart/i)).toBeInTheDocument();
  });

  it("names the noteheads it ignored", () => {
    const plan = buildPlan([bell("C", 0, 5), bell("D", 0, 5, "x")], {
      headMapping: DEFAULT_HEAD_MAPPING,
    });
    const { container } = render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    // The notehead table's whole premise is that an arranger who wrote their
    // chimes as `x` finds out. If this warning never renders, they never do.
    // No section label mentions noteheads, so this matches the warning alone.
    expect(container.textContent).toMatch(/notehead/i);
  });

  it("names silver melody bells outside their compass", () => {
    const plan = buildPlan([bell("C", 0, 4, "la"), bell("E", 0, 6, "la")], {
      headMapping: DEFAULT_HEAD_MAPPING,
    });
    const { container } = render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    // The third warning type, and the likeliest to be left unrendered: it
    // cannot occur on a bells-only score, so no other test here produces one.
    // C4 is outside the SMB compass, so it is excluded from the chart and
    // appears only in the warning — matching it cannot pick up a bell list.
    expect(container.textContent).toMatch(/C4/);
  });

  it("uses singular wording for exactly one unreadable note", () => {
    const plan = buildPlan([bell("C", 0, 5)], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<Summary plan={plan} hasExistingChart={false} unreadable={1} />);
    expect(screen.getByText(/1 note could not be read.*was left off/i)).toBeInTheDocument();
  });

  it("colours chime names with the chosen colour, leaving handbell names default", () => {
    const plan = buildPlan([bell("D", 1, 5, "diamond"), bell("C", 0, 5)], {
      headMapping: DEFAULT_HEAD_MAPPING,
      chimeColor: "#336699",
    });
    const { container } = render(<Summary plan={plan} hasExistingChart={false} unreadable={0} />);
    const names = [...container.querySelectorAll<HTMLElement>(".name")];
    const bellName = names.find((element) => element.textContent === "C5");
    const chimeName = names.find((element) => element.textContent === "D#5");
    expect(bellName?.style.color).toBe("");
    expect(chimeName?.style.color).not.toBe("");
  });
});
