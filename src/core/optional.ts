import { isOptional } from "./range.js";

import type { BuiltColumns, Column } from "./columns.js";
import type { BellRange } from "./range.js";

export interface OptionalRun {
  readonly staff: "treble" | "bass";
  readonly firstColumn: number;
  readonly lastColumn: number;
}

const STAVES = ["treble", "bass"] as const;

/**
 * A run is the span from the first optional column on a staff to the last,
 * gaps included — one bracket per staff, which is what published charts draw.
 * A column counts as optional when any bell in it is.
 */
function runFor(columns: readonly Column[], range: BellRange): Omit<OptionalRun, "staff"> | null {
  let first = -1;
  let last = -1;
  for (const [index, column] of columns.entries()) {
    if (!column.some((entry) => isOptional(range, entry.midi))) {
      continue;
    }
    if (first < 0) {
      first = index;
    }
    last = index;
  }
  return first < 0 ? null : { firstColumn: first, lastColumn: last };
}

export function optionalRuns(built: BuiltColumns, range: BellRange): OptionalRun[] {
  const runs: OptionalRun[] = [];
  for (const staff of STAVES) {
    const run = runFor(built[staff], range);
    if (run !== null) {
      runs.push({ staff, ...run });
    }
  }
  return runs;
}

/** How many columns the bracket reaches across. Zero draws no line at all. */
export function spanColumns(run: OptionalRun): number {
  return run.lastColumn - run.firstColumn;
}

/**
 * The column the word is anchored to, so it centres on its bracket. An
 * even-length run floors to the earlier column rather than sitting on a
 * half-column boundary.
 */
export function wordColumn(run: OptionalRun): number {
  return Math.floor((run.firstColumn + run.lastColumn) / 2);
}

/**
 * Optional bells are the extremes of the range, so the treble staff's sit
 * above it and the bass staff's below, each clear of the notes they belong to.
 */
export function isAbove(run: OptionalRun): boolean {
  return run.staff === "treble";
}
