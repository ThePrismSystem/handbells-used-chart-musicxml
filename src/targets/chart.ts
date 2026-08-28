import { addOctaves } from "../core/pitch.js";
import { CHART_PART_NAME } from "../musicxml/marker.js";

import { el } from "./elements.js";

import type { TargetProfile } from "./types.js";
import type { Column } from "../core/columns.js";
import type { ChartSection } from "../core/plan.js";
import type { Alter, ChartKind } from "../core/types.js";

/**
 * What a chart part looks like, independent of where it ends up. Two emitters
 * share this: targets/emit.ts inserts chart parts into the score itself, and
 * targets/flow.ts writes them as a document of their own. Everything that
 * differs between those two lives in the caller, not here.
 */

/** accidental-value has no "double-flat"; a double flat is "flat-flat". */
const ACCIDENTAL: Record<Alter, string> = {
  [-2]: "flat-flat",
  [-1]: "flat",
  [0]: "natural",
  [1]: "sharp",
  [2]: "double-sharp",
};

const INSTRUMENT_SOUND: Record<ChartKind, string> = {
  bells: "pitched-percussion.handbells",
  chimes: "pitched-percussion.handchimes",
  // No standard sound exists for silver melody bells; they are handbells.
  smbs: "pitched-percussion.handbells",
};

const INSTRUMENT_NAME: Record<ChartKind, string> = {
  bells: "Handbells",
  chimes: "Handchimes",
  smbs: "Silver Melody Bells",
};

/** One column is one quarter, so a counted measure is `columns` quarters long. */
export const BEAT_TYPE = "4";

/**
 * The chart's own metre. "counted" states a time signature of one beat per
 * column and hides it; "open" states senza-misura, which has no signature to
 * hide and so leaves nothing for a reader to mark as hidden.
 */
export type ChartMetre =
  { readonly kind: "counted"; readonly beats: number } | { readonly kind: "open" };

export function chartScorePart(doc: Document, id: string, section: ChartSection): Element {
  const scorePart = el(doc, "score-part", undefined, { id });
  // The chart's visible label is a direction above the staves, not a margin
  // name, so the part name is marked not to print. Dorico prints it regardless
  // — an empty <part-name-display print-object="no"/> did not stop it either,
  // so its staff labels are turned off by the setup script instead. The name
  // still earns its place as the marker that survives a round trip, which is
  // why each kind carries its own rather than one shared string.
  scorePart.append(el(doc, "part-name", CHART_PART_NAME[section.kind], { "print-object": "no" }));

  const instrument = el(doc, "score-instrument", undefined, { id: `${id}-I1` });
  instrument.append(el(doc, "instrument-name", INSTRUMENT_NAME[section.kind]));
  instrument.append(el(doc, "instrument-sound", INSTRUMENT_SOUND[section.kind]));
  scorePart.append(instrument);
  return scorePart;
}

function clef(doc: Document, number: string, sign: string, line: string): Element {
  const element = el(doc, "clef", undefined, { number });
  element.append(el(doc, "sign", sign));
  element.append(el(doc, "line", line));
  // The 8va convention: written pitch sounds an octave higher.
  element.append(el(doc, "clef-octave-change", "1"));
  return element;
}

/** Order is fixed by the schema: divisions, key, time, staves, part-symbol, clef, staff-details, transpose. */
export function chartAttributes(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  divisions: number,
  metre: ChartMetre,
): Element {
  const attributes = el(doc, "attributes");
  attributes.append(el(doc, "divisions", String(divisions)));

  // C major draws nothing, so it needs no hiding. A key marked print-object
  // "no" is a hidden item, which Dorico marks with a signpost; a plain C major
  // is simply a key with no accidentals in it.
  const key = el(doc, "key");
  key.append(el(doc, "fifths", "0"));
  attributes.append(key);

  const time = el(doc, "time", undefined, metre.kind === "open" ? {} : { "print-object": "no" });
  if (metre.kind === "open") {
    time.append(el(doc, "senza-misura"));
  } else {
    time.append(el(doc, "beats", String(metre.beats)));
    time.append(el(doc, "beat-type", BEAT_TYPE));
  }
  attributes.append(time);

  attributes.append(el(doc, "staves", String(section.staves)));
  if (section.staves === 2) {
    attributes.append(el(doc, "part-symbol", "brace"));
  }

  attributes.append(clef(doc, "1", "G", "2"));
  if (section.staves === 2) {
    attributes.append(clef(doc, "2", "F", "4"));
  }

  if (profile.chartStaffSizePercent !== null) {
    for (let staff = 1; staff <= section.staves; staff++) {
      const details = el(doc, "staff-details", undefined, { number: String(staff) });
      details.append(el(doc, "staff-size", String(profile.chartStaffSizePercent)));
      attributes.append(details);
    }
  }

  if (profile.octaveVia === "clef+transpose") {
    const transpose = el(doc, "transpose");
    transpose.append(el(doc, "diatonic", "0"));
    transpose.append(el(doc, "chromatic", "0"));
    transpose.append(el(doc, "octave-change", "1"));
    attributes.append(transpose);
  }

  return attributes;
}

/** Order is fixed by the schema: chord, pitch, duration, voice, type, accidental, stem, notehead, staff. */
function chartNote(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  column: Column,
  staff: number,
  divisions: number,
): Element[] {
  return column.map((entry, index) => {
    const note = el(doc, "note");
    if (index > 0) {
      note.append(el(doc, "chord"));
    }

    // Under the 8va clef a bell is written an octave below its name — unless
    // the target lowers the notehead by that clef itself, in which case the
    // bell's own pitch is what lands in the right place. See writtenOctaveShift.
    const written = addOctaves(entry.pitch, profile.writtenOctaveShift);
    const pitch = el(doc, "pitch");
    pitch.append(el(doc, "step", written.step));
    if (written.alter !== 0) {
      pitch.append(el(doc, "alter", String(written.alter)));
    }
    pitch.append(el(doc, "octave", String(written.octave)));
    note.append(pitch);

    note.append(el(doc, "duration", String(divisions)));
    note.append(el(doc, "voice", String(staff)));
    note.append(el(doc, "type", "quarter"));

    // <accidental> has no print-object, so a natural is omitted rather than
    // hidden: in MusicXML the element *is* the print instruction.
    if (written.alter !== 0) {
      note.append(el(doc, "accidental", ACCIDENTAL[written.alter]));
    }

    note.append(el(doc, "stem", "none"));
    note.append(el(doc, "notehead", section.notehead, { color: section.color }));
    note.append(el(doc, "staff", String(staff)));
    return note;
  });
}

function paddingRest(doc: Document, staff: number, divisions: number): Element {
  const note = el(doc, "note", undefined, { "print-object": "no" });
  note.append(el(doc, "rest"));
  note.append(el(doc, "duration", String(divisions)));
  note.append(el(doc, "voice", String(staff)));
  note.append(el(doc, "type", "quarter"));
  note.append(el(doc, "staff", String(staff)));
  return note;
}

function staffContent(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  columns: readonly Column[],
  staff: number,
  from: number,
  count: number,
  divisions: number,
): Element[] {
  const out: Element[] = [];
  for (let index = 0; index < count; index++) {
    const column = columns[from + index];
    if (column === undefined || column.length === 0) {
      out.push(paddingRest(doc, staff, divisions));
    } else {
      out.push(...chartNote(doc, section, profile, column, staff, divisions));
    }
  }
  return out;
}

export function chartLabel(doc: Document, text: string): Element {
  const direction = el(doc, "direction", undefined, { placement: "above" });
  const type = el(doc, "direction-type");
  type.append(el(doc, "words", text));
  direction.append(type);
  return direction;
}

/**
 * One measure's worth of chart: the treble staff's columns, then a backup over
 * them, then the bass staff's. The measure element itself belongs to the
 * caller, since an inserted chart and a standalone one number and mark it
 * differently.
 */
export function chartMeasureContent(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  divisions: number,
  from: number,
  count: number,
): Element[] {
  const out = [...staffContent(doc, section, profile, section.treble, 1, from, count, divisions)];

  if (section.staves === 2) {
    const backup = el(doc, "backup");
    backup.append(el(doc, "duration", String(count * divisions)));
    out.push(backup);
    out.push(...staffContent(doc, section, profile, section.bass, 2, from, count, divisions));
  }

  return out;
}

/** Chart measures carry no barline of their own; the chart is not metrical music. */
export function invisibleBarline(doc: Document): Element {
  const barline = el(doc, "barline", undefined, { location: "right" });
  barline.append(el(doc, "bar-style", "none"));
  return barline;
}
