import type { TargetProfile } from "./types.js";

export const DORICO: TargetProfile = {
  id: "dorico",
  label: "Dorico",
  // hideChartStavesAfterChart and columnsPerMeasure were measured against
  // Dorico, not chosen. Dorico ignores <staff-details print-object="no">, so
  // emitting it only leaves an element no other application needs to see; and
  // with a whole chart in one bar it prints its own naturals to cancel earlier
  // accidentals in that bar, which one column per bar makes unnecessary.
  hideChartStavesAfterChart: false,
  systemBreakAfterChart: true,
  chartStaffSizePercent: 80,
  implicitMeasureNumber: "0",
  columnsPerMeasure: 1,
  octaveVia: "clef",
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
};

export const TARGETS: readonly TargetProfile[] = [DORICO, GENERIC];

export function targetById(id: string): TargetProfile {
  return TARGETS.find((target) => target.id === id) ?? DORICO;
}
