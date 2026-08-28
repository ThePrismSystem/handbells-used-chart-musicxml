import {
  BEAT_TYPE,
  chartAttributes,
  chartLabel,
  chartMeasureContent,
  chartScorePart,
  invisibleBarline,
} from "./chart.js";
import { el } from "./elements.js";

import type { TargetProfile } from "./types.js";
import type { ChartPlan, ChartSection } from "../core/plan.js";
import type { ExistingChart } from "../musicxml/marker.js";

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
    measure.append(
      chartAttributes(doc, section, profile, divisions, { kind: "counted", beats: count }),
    );
    measure.append(chartLabel(doc, section.label));
  }

  for (const node of chartMeasureContent(doc, section, profile, divisions, from, count)) {
    measure.append(node);
  }

  measure.append(invisibleBarline(doc));
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

  measure.append(invisibleBarline(doc));
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

  measure.append(invisibleBarline(doc));
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

    partList.insertBefore(chartScorePart(doc, id, section), firstScorePart);

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
