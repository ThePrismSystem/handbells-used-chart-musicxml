import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PartsPanel } from "./PartsPanel.js";

import type { PartInfo } from "../musicxml/read.js";

const parts: PartInfo[] = [
  {
    id: "P1",
    name: "Handbells",
    convention: "written-octave-below",
    reason: "instrument-sound: pitched-percussion.handbells, with a <transpose> of one octave",
    noteCount: 312,
  },
  {
    id: "P2",
    name: "Piano",
    convention: "written-octave-below",
    reason: "no signal; assumed handbell convention",
    noteCount: 47,
  },
];

const conventions = new Map(parts.map((p) => [p.id, p.convention]));

describe("PartsPanel", () => {
  it("shows the reason for each guess", () => {
    // A bare toggle with no reasoning gives the user nothing to evaluate.
    render(<PartsPanel parts={parts} conventions={conventions} onChange={vi.fn()} />);
    expect(screen.getByText(/pitched-percussion.handbells/)).toBeInTheDocument();
    expect(screen.getByText(/no signal/)).toBeInTheDocument();
  });

  it("lets a part's convention be overridden", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PartsPanel parts={parts} conventions={conventions} onChange={onChange} />);
    const group = screen.getByRole("group", { name: /piano/i });
    await user.click(within(group).getByRole("radio", { name: /already sounding|bell name/i }));
    expect(onChange).toHaveBeenCalledWith("P2", "at-bell-name");
  });

  it("shows each part's note count", () => {
    render(<PartsPanel parts={parts} conventions={conventions} onChange={vi.fn()} />);
    // Both parts, not just the first: a panel that rendered one count for
    // every part would pass a single-value assertion.
    for (const part of parts) {
      const group = screen.getByRole("group", { name: new RegExp(part.name, "i") });
      expect(within(group).getByText(String(part.noteCount))).toBeInTheDocument();
    }
  });

  it("falls back to the detected convention when it has not been overridden", () => {
    const detectedAtBellName: PartInfo = {
      id: "P3",
      name: "Organ",
      convention: "at-bell-name",
      reason: "instrument-sound: keyboard.organ, but no <transpose> — pitches read as sounding",
      noteCount: 20,
    };
    render(<PartsPanel parts={[detectedAtBellName]} conventions={new Map()} onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: /organ/i });
    expect(within(group).getByRole("radio", { name: /already sounding|bell name/i })).toBeChecked();
  });

  it("uses singular wording for exactly one note", () => {
    const onePart: PartInfo = {
      id: "P4",
      name: "Solo",
      convention: "written-octave-below",
      reason: "no signal; assumed handbell convention",
      noteCount: 1,
    };
    const { container } = render(
      <PartsPanel parts={[onePart]} conventions={new Map()} onChange={vi.fn()} />,
    );
    // The count sits in its own element (see "shows each part's note count"
    // above), so the agreement can only be asserted against the panel's
    // combined text — and this pattern would fail against "1 notes read".
    expect(container.textContent).toMatch(/1 note read/);
  });
});
