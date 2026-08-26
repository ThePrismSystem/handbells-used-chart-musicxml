import type { TargetProfile } from "./types.js";

export const DORICO: TargetProfile = {
  id: "dorico",
  label: "Dorico",
  // Every value below except systemBreakAfterChart and implicitMeasureNumber
  // was measured against Dorico rather than chosen. Dorico ignores
  // <staff-details print-object="no"> and <staff-size> alike, so emitting
  // either only leaves an element no other application needs to see. It also
  // reads <pitch> as the sounding pitch and lowers the notehead by the clef's
  // octave change, so the chart is handed the bell's own pitch and lands where
  // the score writes it. One column per bar does not stop Dorico restating a
  // cancelling natural, but it moves that restatement into Dorico's own
  // next-bar rule, which is a setting the reader can turn off.
  hideChartStavesAfterChart: false,
  systemBreakAfterChart: true,
  chartStaffSizePercent: null,
  implicitMeasureNumber: "0",
  columnsPerMeasure: 1,
  octaveVia: "clef",
  writtenOctaveShift: 0,
};

export const GENERIC: TargetProfile = {
  id: "generic",
  label: "Generic MusicXML",
  hideChartStavesAfterChart: true,
  systemBreakAfterChart: true,
  chartStaffSizePercent: null,
  implicitMeasureNumber: "0",
  columnsPerMeasure: "all",
  octaveVia: "clef",
  // MusicXML's own reading: <pitch> is the written pitch, so the 8va clef
  // above it is what names the bell. Unverified against any one application.
  writtenOctaveShift: -1,
};

export const TARGETS: readonly TargetProfile[] = [DORICO, GENERIC];

export function targetById(id: string): TargetProfile {
  return TARGETS.find((target) => target.id === id) ?? DORICO;
}
