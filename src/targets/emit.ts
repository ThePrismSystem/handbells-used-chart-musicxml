import { addOctaves } from "../core/pitch.js";
import { CHART_PART_NAME } from "../musicxml/marker.js";

import { el } from "./elements.js";

import type { TargetProfile } from "./types.js";
import type { Column } from "../core/columns.js";
import type { ChartPlan, ChartSection } from "../core/plan.js";
import type { Alter, ChartKind } from "../core/types.js";
import type { ExistingChart } from "../musicxml/marker.js";

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

/** One column is one quarter, so the measure is `columns` quarters long. */
const BEAT_TYPE = "4";

function readDivisions(doc: Document): number {
  const text = doc.querySelector("score-partwise > part > measure > attributes > divisions");
  const value = Number(text?.textContent ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function uniqueId(doc: Document, index: number): string {
  let candidate = `HBC${String(index)}`;
  let suffix = 0;
  while (doc.querySelector(`part-list > score-part[id="${candidate}"]`) !== null) {
    suffix++;
    candidate = `HBC${String(index)}_${String(suffix)}`;
  }
  return candidate;
}

function scorePartFor(doc: Document, id: string, section: ChartSection): Element {
  const scorePart = el(doc, "score-part", undefined, { id });
  // The chart's visible label is a direction above the staves, not a margin
  // name, so the part name is marked not to print. Dorico prints it anyway,
  // which is why each kind's name is its own rather than one shared marker.
  scorePart.append(el(doc, "part-name", CHART_PART_NAME[section.kind], { "print-object": "no" }));
  // Dorico ignores print-object on part-name and prints it as the staff label
  // anyway. part-name-display is the element that overrides what is drawn, and
  // an empty one marked not to print leaves the chart staves unlabelled.
  scorePart.append(el(doc, "part-name-display", undefined, { "print-object": "no" }));

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
function chartAttributes(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  divisions: number,
  beats: number,
): Element {
  const attributes = el(doc, "attributes");
  attributes.append(el(doc, "divisions", String(divisions)));

  const key = el(doc, "key", undefined, { "print-object": "no" });
  key.append(el(doc, "fifths", "0"));
  attributes.append(key);

  const time = el(doc, "time", undefined, { "print-object": "no" });
  time.append(el(doc, "beats", String(beats)));
  time.append(el(doc, "beat-type", BEAT_TYPE));
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

function label(doc: Document, text: string): Element {
  const direction = el(doc, "direction", undefined, { placement: "above" });
  const type = el(doc, "direction-type");
  type.append(el(doc, "words", text));
  direction.append(type);
  return direction;
}

function chartMeasure(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  divisions: number,
  index: number,
  from: number,
  count: number,
): Element {
  const measure = el(doc, "measure", undefined, {
    number:
      index === 0
        ? profile.implicitMeasureNumber
        : `${profile.implicitMeasureNumber}.${String(index)}`,
    implicit: "yes",
  });

  if (index === 0) {
    measure.append(chartAttributes(doc, section, profile, divisions, count));
    measure.append(label(doc, section.label));
  }

  for (const note of staffContent(
    doc,
    section,
    profile,
    section.treble,
    1,
    from,
    count,
    divisions,
  )) {
    measure.append(note);
  }

  if (section.staves === 2) {
    const backup = el(doc, "backup");
    backup.append(el(doc, "duration", String(count * divisions)));
    measure.append(backup);
    for (const note of staffContent(
      doc,
      section,
      profile,
      section.bass,
      2,
      from,
      count,
      divisions,
    )) {
      measure.append(note);
    }
  }

  const barline = el(doc, "barline", undefined, { location: "right" });
  barline.append(el(doc, "bar-style", "none"));
  measure.append(barline);
  return measure;
}

/**
 * The part's own opening attributes, cloned onto the silent measure that now
 * precedes them, with only <time> replaced by the chart's metre. The prefix
 * opens the part, so it has to establish what the part's first bar used to:
 * without a <key> a reader takes the piece as opening atonal and prints a key
 * change at the first real bar.
 */
function prefixAttributes(doc: Document, opening: Element | null, count: number): Element {
  const attributes =
    opening === null ? el(doc, "attributes") : (opening.cloneNode(true) as Element);

  const time = el(doc, "time", undefined, { "print-object": "no" });
  time.append(el(doc, "beats", String(count)));
  time.append(el(doc, "beat-type", BEAT_TYPE));

  const existing = attributes.querySelector(":scope > time");
  if (existing === null) {
    // Schema order is divisions, key, time, staves, part-symbol, instruments,
    // clef, staff-details, transpose. With no <time> to replace, the new one
    // goes ahead of the first element the schema puts after it.
    attributes.insertBefore(
      time,
      attributes.querySelector(
        ":scope > staves, :scope > part-symbol, :scope > instruments, :scope > clef," +
          " :scope > staff-details, :scope > transpose",
      ),
    );
  } else {
    existing.replaceWith(time);
  }
  return attributes;
}

/** A silent, invisible measure that keeps a part in step with the chart. */
function silentMeasure(
  doc: Document,
  profile: TargetProfile,
  index: number,
  count: number,
  divisions: number,
  opening: Element | null,
): Element {
  const measure = el(doc, "measure", undefined, {
    number:
      index === 0
        ? profile.implicitMeasureNumber
        : `${profile.implicitMeasureNumber}.${String(index)}`,
    implicit: "yes",
  });

  if (index === 0) {
    measure.append(prefixAttributes(doc, opening, count));
  }

  const note = el(doc, "note", undefined, { "print-object": "no" });
  note.append(el(doc, "rest", undefined, { measure: "yes" }));
  note.append(el(doc, "duration", String(count * divisions)));
  note.append(el(doc, "voice", "1"));
  measure.append(note);

  const barline = el(doc, "barline", undefined, { location: "right" });
  barline.append(el(doc, "bar-style", "none"));
  measure.append(barline);
  return measure;
}

interface Metre {
  readonly beats: number;
  readonly beatType: number;
}

/**
 * A measure's own duration in divisions. `divisions` counts per quarter note by
 * definition, so a metre whose measure is not a whole number of them could not
 * express its own notes either.
 */
function metreDuration(metre: Metre, divisions: number): number {
  return (metre.beats * divisions * 4) / metre.beatType;
}

function metreOf(measure: Element): Metre | null {
  const time = measure.querySelector(":scope > attributes > time");
  const beats = Number(time?.querySelector("beats")?.textContent);
  const beatType = Number(time?.querySelector("beat-type")?.textContent);
  return beats > 0 && beatType > 0 ? { beats, beatType } : null;
}

/**
 * The chart part's tail, which runs alongside the music. Unlike the silent
 * measures prepended to the music parts, these follow the MUSIC's metre: the
 * chart part is coming out of the chart's own time signature and has to be put
 * back, or it runs the whole piece in the wrong metre and at the wrong measure
 * duration.
 */
function silentTail(
  doc: Document,
  number: string,
  metre: Metre,
  divisions: number,
  declareMetre: boolean,
): Element {
  const measure = el(doc, "measure", undefined, { number });

  if (declareMetre) {
    const attributes = el(doc, "attributes");
    const time = el(doc, "time", undefined, { "print-object": "no" });
    time.append(el(doc, "beats", String(metre.beats)));
    time.append(el(doc, "beat-type", String(metre.beatType)));
    attributes.append(time);
    measure.append(attributes);
  }

  const note = el(doc, "note", undefined, { "print-object": "no" });
  note.append(el(doc, "rest", undefined, { measure: "yes" }));
  note.append(el(doc, "duration", String(metreDuration(metre, divisions))));
  note.append(el(doc, "voice", "1"));
  measure.append(note);

  const barline = el(doc, "barline", undefined, { location: "right" });
  barline.append(el(doc, "bar-style", "none"));
  measure.append(barline);
  return measure;
}

/** Hides the chart's own staves once the music starts. */
function hideAfterChart(doc: Document, measure: Element, staves: number): void {
  const attributes = el(doc, "attributes");
  for (let staff = 1; staff <= staves; staff++) {
    attributes.append(
      el(doc, "staff-details", undefined, { number: String(staff), "print-object": "no" }),
    );
  }
  measure.prepend(attributes);
}

export function emitChart(doc: Document, plan: ChartPlan, profile: TargetProfile): ExistingChart {
  if (plan.sections.length === 0) {
    return { partIds: [], measures: 0, printParts: [] };
  }

  const divisions = readDivisions(doc);
  const width = Math.max(...plan.sections.map((section) => section.columns));
  const perMeasure = profile.columnsPerMeasure === "all" ? width : profile.columnsPerMeasure;
  const measureCount = Math.ceil(width / perMeasure);

  const partList = doc.querySelector("score-partwise > part-list");
  const firstMusicPart = doc.querySelector("score-partwise > part");
  if (partList === null || firstMusicPart === null) {
    return { partIds: [], measures: 0, printParts: [] };
  }

  const musicParts = [...doc.querySelectorAll("score-partwise > part")];
  const partIds: string[] = [];

  // The music's own measure numbers, so the chart part's silent tail matches
  // them. A score may open on a pickup numbered 0, so counting from 1 is wrong.
  // The governing metre travels with each number and carries forward, since a
  // measure only declares <time> when it changes.
  let governing: Metre = { beats: perMeasure, beatType: Number(BEAT_TYPE) };
  const musicMeasures = [...firstMusicPart.querySelectorAll(":scope > measure")].map(
    (measure, index) => {
      governing = metreOf(measure) ?? governing;
      return {
        number: measure.getAttribute("number") ?? String(index + 1),
        metre: governing,
      };
    },
  );

  // Chart parts sit at the top of the system, so both the score-part and the
  // part go ahead of the first music one. Inserting each before the same
  // anchor leaves the sections in plan order.
  const firstScorePart = partList.querySelector(":scope > score-part");
  const firstPart = musicParts[0] ?? null;

  for (const [sectionIndex, section] of plan.sections.entries()) {
    const id = uniqueId(doc, sectionIndex + 1);
    partIds.push(id);

    partList.insertBefore(scorePartFor(doc, id, section), firstScorePart);

    const part = el(doc, "part", undefined, { id });
    for (let index = 0; index < measureCount; index++) {
      const from = index * perMeasure;
      const count = Math.min(perMeasure, width - from);
      part.append(chartMeasure(doc, section, profile, divisions, index, from, count));
    }

    // A silent tail keeps the chart part in step with every other part — the
    // same measure count, and the same metre and duration in each of them.
    // Starting from "" makes the first tail measure always restate the metre:
    // the chart part is coming out of its own time signature and cannot
    // inherit the music's.
    let declared = "";
    for (const { number, metre } of musicMeasures) {
      const signature = `${String(metre.beats)}/${String(metre.beatType)}`;
      part.append(silentTail(doc, number, metre, divisions, signature !== declared));
      declared = signature;
    }

    if (profile.hideChartStavesAfterChart) {
      const first = part.querySelectorAll(":scope > measure")[measureCount];
      if (first !== undefined) {
        hideAfterChart(doc, first, section.staves);
      }
    }

    doc.documentElement.insertBefore(part, firstPart);
  }

  const printParts: string[] = [];
  for (const part of musicParts) {
    // Divisions are per-part in MusicXML, and the prefix declares this part's
    // along with the rest of its opening attributes, so its rest is counted in
    // them rather than in the first part's.
    const opening = part.querySelector(":scope > measure > attributes");
    const declared = Number(opening?.querySelector(":scope > divisions")?.textContent);
    const partDivisions = declared > 0 ? declared : divisions;

    for (let index = measureCount - 1; index >= 0; index--) {
      const from = index * perMeasure;
      const count = Math.min(perMeasure, width - from);
      part.prepend(silentMeasure(doc, profile, index, count, partDivisions, opening));
    }

    if (profile.systemBreakAfterChart) {
      const music = part.querySelectorAll(":scope > measure")[measureCount];
      const id = part.getAttribute("id");
      if (music !== undefined && id !== null && music.querySelector(":scope > print") === null) {
        music.prepend(el(doc, "print", undefined, { "new-system": "yes" }));
        printParts.push(id);
      }
    }
  }

  return { partIds, measures: measureCount, printParts };
}
