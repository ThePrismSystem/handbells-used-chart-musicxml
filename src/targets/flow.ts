import { parseScore, serializeScore } from "../musicxml/document.js";

import {
  chartAttributes,
  chartLabel,
  chartMeasureContent,
  chartScorePart,
  invisibleBarline,
} from "./chart.js";
import { el } from "./elements.js";

import type { TargetProfile } from "./types.js";
import type { ChartPlan, ChartSection } from "../core/plan.js";

/**
 * The chart as a document of its own, for an application whose import can add
 * it to a project the user already has open. Nothing here touches the score:
 * a used chart is made at the end of the writing, when the score is fully
 * engraved, so re-importing it would throw that engraving away.
 */

/** Names the flow in Dorico's Flows panel. */
const FLOW_TITLE = "Handbells Used Chart";

/** Every chart note is a quarter, so one division per quarter is enough. */
const DIVISIONS = 1;

/**
 * An empty score-partwise, only so the declaration and doctype come from the
 * same place every other document in this codebase gets them. Everything
 * inside it is built rather than parsed.
 */
const SKELETON =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"' +
  ' "http://www.musicxml.org/dtds/partwise.dtd">\n' +
  '<score-partwise version="4.0"/>';

function chartMeasure(
  doc: Document,
  section: ChartSection,
  profile: TargetProfile,
  index: number,
  from: number,
  count: number,
): Element {
  // Implicit is MusicXML's own "this bar does not count", which is what a
  // chart bar is: it holds bells, not a bar of the music.
  const measure = el(doc, "measure", undefined, {
    number: String(index + 1),
    implicit: "yes",
  });

  if (index === 0) {
    measure.append(chartAttributes(doc, section, profile, DIVISIONS, { kind: "open" }));
    measure.append(chartLabel(doc, section.label));
  }

  for (const node of chartMeasureContent(doc, section, profile, DIVISIONS, from, count)) {
    measure.append(node);
  }

  measure.append(invisibleBarline(doc));
  return measure;
}

/**
 * Returns null for a plan with no sections: a score-partwise document needs at
 * least one part, so an empty chart has no file to be.
 */
export function emitChartFlow(plan: ChartPlan, profile: TargetProfile): string | null {
  if (plan.sections.length === 0) {
    return null;
  }

  const parsed = parseScore(SKELETON);
  const { doc } = parsed;
  const root = doc.documentElement;

  // Schema order: movement-title, then part-list, then the parts.
  root.append(el(doc, "movement-title", FLOW_TITLE));
  const partList = el(doc, "part-list");
  root.append(partList);

  const width = Math.max(...plan.sections.map((section) => section.columns));
  const perMeasure = profile.columnsPerMeasure === "all" ? width : profile.columnsPerMeasure;
  const measureCount = Math.ceil(width / perMeasure);

  for (const [sectionIndex, section] of plan.sections.entries()) {
    const id = `HBC${String(sectionIndex + 1)}`;
    partList.append(chartScorePart(doc, id, section));

    const part = el(doc, "part", undefined, { id });
    for (let index = 0; index < measureCount; index++) {
      const from = index * perMeasure;
      part.append(
        chartMeasure(doc, section, profile, index, from, Math.min(perMeasure, width - from)),
      );
    }
    root.append(part);
  }

  return serializeScore(parsed);
}
