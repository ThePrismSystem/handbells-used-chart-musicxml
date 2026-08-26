import type { ChartEntry, Region } from "./types.js";

export type Column = readonly ChartEntry[];

export interface BuiltColumns {
  readonly treble: Column[];
  readonly bass: Column[];
  readonly length: number;
}

const SEMITONES_PER_OCTAVE = 12;

interface Attachment {
  readonly list: readonly ChartEntry[];
  readonly offset: number;
}

interface Building {
  readonly sortMidi: number;
  readonly sortAlter: number;
  readonly notes: ChartEntry[];
}

/**
 * Two bells with the same letter and the same alteration share a spelling, so
 * an anchor is found by (midi - offset, step, alter) — matching spelling as
 * well as pitch.
 */
function anchorKey(midi: number, entry: ChartEntry): string {
  return `${String(midi)}:${entry.pitch.step}:${String(entry.pitch.alter)}`;
}

function single(list: readonly ChartEntry[]): Column[] {
  // anchor() re-sorts its own output, so single() must too: otherwise the
  // bass staff is the one region whose order depends on the caller.
  return [...list].sort((a, b) => a.midi - b.midi).map((entry) => [entry]);
}

/**
 * Builds columns around `anchors`, attaching each entry in `attachments` to the
 * anchor `offset` semitones away with the same spelling. An entry with no
 * anchor becomes its own column, sorted as though its anchor existed, so the
 * left-to-right reading order stays ascending.
 */
function anchor(anchors: readonly ChartEntry[], attachments: readonly Attachment[]): Column[] {
  const columns: Building[] = [];
  const index = new Map<string, number>();

  for (const entry of anchors) {
    index.set(anchorKey(entry.midi, entry), columns.length);
    columns.push({ sortMidi: entry.midi, sortAlter: -entry.pitch.alter, notes: [entry] });
  }

  for (const attachment of attachments) {
    for (const entry of attachment.list) {
      const anchorMidi = entry.midi - attachment.offset;
      const key = anchorKey(anchorMidi, entry);
      const at = index.get(key);
      if (at === undefined) {
        index.set(key, columns.length);
        columns.push({ sortMidi: anchorMidi, sortAlter: -entry.pitch.alter, notes: [entry] });
      } else {
        columns[at]?.notes.push(entry);
      }
    }
  }

  columns.sort((a, b) => a.sortMidi - b.sortMidi || a.sortAlter - b.sortAlter);
  return columns.map((column) => [...column.notes].sort((a, b) => a.midi - b.midi));
}

export function buildColumns(entries: readonly ChartEntry[]): BuiltColumns {
  const byRegion: Record<Region, ChartEntry[]> = {
    bassRow2: [],
    bassRow1: [],
    bassStaff: [],
    trebleStaff: [],
    trebleRow1: [],
    trebleRow2: [],
  };
  for (const entry of entries) {
    byRegion[entry.region].push(entry);
  }

  const treble = anchor(byRegion.trebleStaff, [
    { list: byRegion.trebleRow1, offset: SEMITONES_PER_OCTAVE },
    { list: byRegion.trebleRow2, offset: SEMITONES_PER_OCTAVE * 2 },
  ]);

  // On the bass side the low bells form their own columns at the left, ahead
  // of the bells that sit on the staff.
  const lowBlock = anchor(byRegion.bassRow1, [
    { list: byRegion.bassRow2, offset: -SEMITONES_PER_OCTAVE },
  ]);
  const bass = [...lowBlock, ...single(byRegion.bassStaff)];

  return { treble, bass, length: Math.max(treble.length, bass.length) };
}
