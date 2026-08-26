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
    expect(screen.getByText("312")).toBeInTheDocument();
  });
});
