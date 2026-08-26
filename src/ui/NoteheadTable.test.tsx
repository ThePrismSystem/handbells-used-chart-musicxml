import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteheadTable } from "./NoteheadTable.js";

import type { Assignment } from "./useChartSession.js";

const counts = new Map([
  ["normal", 312],
  ["diamond", 47],
  ["x", 8],
]);

const assignments = new Map<string, Assignment>([
  ["normal", "bells"],
  ["diamond", "chimes"],
  ["x", "ignore"],
]);

describe("NoteheadTable", () => {
  it("is a real table with associated headers", () => {
    // Not a row of cards: someone scanning for a large count in Ignore needs
    // to compare rows.
    render(<NoteheadTable counts={counts} assignments={assignments} onAssign={vi.fn()} />);
    const table = screen.getByRole("table", { name: /notehead/i });
    expect(within(table).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(3);
  });

  it("lists every notehead found, with its count", () => {
    render(<NoteheadTable counts={counts} assignments={assignments} onAssign={vi.fn()} />);
    const row = screen.getByRole("row", { name: /^x\b/i });
    expect(within(row).getByText("8")).toBeInTheDocument();
  });

  it("gives each row a labelled radio group", () => {
    render(<NoteheadTable counts={counts} assignments={assignments} onAssign={vi.fn()} />);
    const row = screen.getByRole("row", { name: /^x\b/i });
    expect(within(row).getByRole("radio", { name: /ignore/i })).toBeChecked();
    expect(within(row).getByRole("radio", { name: /handchimes/i })).not.toBeChecked();
  });

  it("reports a reassignment", async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();
    render(<NoteheadTable counts={counts} assignments={assignments} onAssign={onAssign} />);
    const row = screen.getByRole("row", { name: /^x\b/i });
    await user.click(within(row).getByRole("radio", { name: /handchimes/i }));
    expect(onAssign).toHaveBeenCalledWith("x", "chimes");
  });

  it("says so when the file has no noteheads at all", () => {
    render(<NoteheadTable counts={new Map()} assignments={new Map()} onAssign={vi.fn()} />);
    expect(screen.getByText(/no notes/i)).toBeInTheDocument();
  });

  it("defaults a notehead with no assignment of its own to ignore", () => {
    const onlyNormal = new Map<string, Assignment>([["normal", "bells"]]);
    render(<NoteheadTable counts={counts} assignments={onlyNormal} onAssign={vi.fn()} />);
    const row = screen.getByRole("row", { name: /^diamond\b/i });
    expect(within(row).getByRole("radio", { name: /ignore/i })).toBeChecked();
  });
});
