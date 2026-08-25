import { SMB_COMPASS, regionOf, toName } from "./pitch.js";

import type { BellRecord, ChartEntry, ChartKind, Region } from "./types.js";

/** Which chart a notehead feeds. A head absent from the map is ignored. */
export type HeadMapping = ReadonlyMap<string, ChartKind>;

/**
 * `la` and `square` both mean a silver melody bell: MuseScore's palette has no
 * notehead called "Square", so the filled square is the shape-note head La,
 * while other applications write a plain square.
 */
export const DEFAULT_HEAD_MAPPING: HeadMapping = new Map<string, ChartKind>([
  ["normal", "bells"],
  ["diamond", "chimes"],
  ["la", "smbs"],
  ["square", "smbs"],
]);

export interface Collected {
  readonly bells: ChartEntry[];
  readonly chimes: ChartEntry[];
  readonly smbs: ChartEntry[];
  readonly ignored: number;
  readonly outOfRange: string[];
  readonly smbOutOfRange: string[];
}

/**
 * Every silver melody bell goes on the treble staff, so the kind needs no
 * region table: the compass is the whole of the check, and what passes it is
 * always in the same place.
 */
function regionFor(kind: ChartKind, entryMidi: number, region: Region | null): Region | null {
  if (kind !== "smbs") {
    return region;
  }
  if (entryMidi < SMB_COMPASS.min || entryMidi > SMB_COMPASS.max) {
    return null;
  }
  return "trebleStaff";
}

function sorted(bucket: Map<string, ChartEntry>): ChartEntry[] {
  // Ascending by pitch, then double-sharp through double-flat, matching the
  // order published charts print enharmonic pairs in.
  return [...bucket.values()].sort((a, b) => a.midi - b.midi || b.pitch.alter - a.pitch.alter);
}

export function collect(records: readonly BellRecord[], mapping: HeadMapping): Collected {
  const buckets: Record<ChartKind, Map<string, ChartEntry>> = {
    bells: new Map(),
    chimes: new Map(),
    smbs: new Map(),
  };
  const outOfRange = new Set<string>();
  const smbOutOfRange = new Set<string>();
  let ignored = 0;

  for (const record of records) {
    const kind = mapping.get(record.notehead);
    if (kind === undefined) {
      ignored++;
      continue;
    }

    const name = toName(record.pitch);
    const region = regionFor(kind, record.midi, regionOf(record.pitch));
    if (region === null) {
      (kind === "smbs" ? smbOutOfRange : outOfRange).add(name);
      continue;
    }

    const key = `${String(record.midi)}:${record.pitch.step}:${String(record.pitch.alter)}`;
    const existing = buckets[kind].get(key);
    if (existing === undefined) {
      buckets[kind].set(key, { pitch: record.pitch, midi: record.midi, name, region, count: 1 });
    } else {
      existing.count++;
    }
  }

  return {
    bells: sorted(buckets.bells),
    chimes: sorted(buckets.chimes),
    smbs: sorted(buckets.smbs),
    ignored,
    outOfRange: [...outOfRange],
    smbOutOfRange: [...smbOutOfRange],
  };
}
