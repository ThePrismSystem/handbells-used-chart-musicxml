import { collect } from "./collect.js";
import { normalizeColor } from "./color.js";
import { buildColumns } from "./columns.js";
import { optionalRuns } from "./optional.js";
import { bellRange } from "./range.js";

import type { HeadMapping } from "./collect.js";
import type { Column } from "./columns.js";
import type { OptionalRun } from "./optional.js";
import type { BellRange } from "./range.js";
import type { BellRecord, ChartEntry, ChartKind } from "./types.js";

export interface PlanOptions {
  readonly headMapping: HeadMapping;
  readonly bellLabel?: string | undefined;
  readonly chimeLabel?: string | undefined;
  readonly smbLabel?: string | undefined;
  readonly chimeColor?: string | null | undefined;
  readonly smbColor?: string | null | undefined;
  readonly smbsOptional?: boolean | undefined;
  readonly requiredBellFirst?: string | null | undefined;
  readonly requiredBellLast?: string | null | undefined;
  readonly requiredChimeFirst?: string | null | undefined;
  readonly requiredChimeLast?: string | null | undefined;
}

interface ChartSection {
  readonly kind: ChartKind;
  /** Two for a grand staff, one for a chart that needs no bass half. */
  readonly staves: 1 | 2;
  readonly label: string;
  readonly columns: number;
  readonly treble: Column[];
  readonly bass: Column[];
  readonly optional: OptionalRun[];
  /** The head the chart draws, which is canonical per kind. */
  readonly notehead: string;
  /** Normalised uppercase hex, or null for the default. */
  readonly color: string | null;
}

type Warning =
  | { readonly type: "ignored-notehead"; readonly count: number }
  | { readonly type: "out-of-range"; readonly names: string[] }
  | { readonly type: "smb-out-of-range"; readonly names: string[] };

export interface ChartPlan {
  readonly sections: ChartSection[];
  readonly warnings: Warning[];
}

/** The chart draws published convention, whatever heads the score used. */
const CANONICAL_HEAD: Record<ChartKind, string> = {
  bells: "normal",
  chimes: "diamond",
  smbs: "la",
};

const DEFAULT_LABEL: Record<ChartKind, string> = {
  bells: "Handbells Used",
  chimes: "Handchimes Used",
  smbs: "SMBs Used",
};

const STAVES: Record<ChartKind, 1 | 2> = { bells: 2, chimes: 2, smbs: 1 };

/**
 * Both ranges are parsed whatever the score turns out to contain. Parsing a
 * range only when its own section exists means a mistyped chime name on a
 * bells-only score is silently ignored, and the user is never told why the
 * range they set did nothing.
 */
export function readRanges(options: PlanOptions): { bells: BellRange; chimes: BellRange } {
  return {
    bells: bellRange(options.requiredBellFirst, options.requiredBellLast, "bell"),
    chimes: bellRange(options.requiredChimeFirst, options.requiredChimeLast, "chime"),
  };
}

/** The label counts physical bells, so two spellings of one pitch count once. */
function distinctPitches(entries: readonly ChartEntry[]): number {
  return new Set(entries.map((entry) => entry.midi)).size;
}

function makeSection(
  kind: ChartKind,
  entries: readonly ChartEntry[],
  label: string | undefined,
  range: BellRange,
  color: string | null,
  allOptional: boolean,
): ChartSection {
  const built = buildColumns(entries);
  return {
    kind,
    staves: STAVES[kind],
    // A custom label replaces the whole of the generated one, the marker
    // included: someone who writes their own wording says everything they want
    // said, and appending to it would be a surprise.
    label:
      label ??
      `${DEFAULT_LABEL[kind]}: ${String(distinctPitches(entries))}${allOptional ? " (optional)" : ""}`,
    columns: built.length,
    treble: built.treble,
    bass: built.bass,
    // Computed from the built columns rather than the entries, because a
    // bracket spans columns and the treble side stacks octaves into them.
    optional: optionalRuns(built, range),
    notehead: CANONICAL_HEAD[kind],
    color,
  };
}

export function buildPlan(records: readonly BellRecord[], options: PlanOptions): ChartPlan {
  const ranges = readRanges(options);
  const collected = collect(records, options.headMapping);
  const sections: ChartSection[] = [];

  if (collected.bells.length > 0) {
    sections.push(
      makeSection("bells", collected.bells, options.bellLabel, ranges.bells, null, false),
    );
  }
  if (collected.chimes.length > 0) {
    sections.push(
      makeSection(
        "chimes",
        collected.chimes,
        options.chimeLabel,
        ranges.chimes,
        normalizeColor(options.chimeColor),
        false,
      ),
    );
  }
  // No range: the whole set is optional or none of it is, so there is nothing
  // for a bracket to single out and the marker goes on the label.
  if (collected.smbs.length > 0) {
    sections.push(
      makeSection(
        "smbs",
        collected.smbs,
        options.smbLabel,
        bellRange(null, null),
        normalizeColor(options.smbColor),
        options.smbsOptional ?? false,
      ),
    );
  }

  const warnings: Warning[] = [];
  if (collected.ignored > 0) {
    warnings.push({ type: "ignored-notehead", count: collected.ignored });
  }
  if (collected.outOfRange.length > 0) {
    warnings.push({ type: "out-of-range", names: collected.outOfRange });
  }
  // Its own type, because the compasses differ: B4 is an ordinary handbell and
  // a silver melody bell nobody makes, so one message cannot name both the
  // pitch and the limit it broke.
  if (collected.smbOutOfRange.length > 0) {
    warnings.push({ type: "smb-out-of-range", names: collected.smbOutOfRange });
  }

  return { sections, warnings };
}
