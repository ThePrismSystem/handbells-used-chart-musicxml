import type { TargetProfile } from "./types.js";

export const DORICO: TargetProfile = {
  id: "dorico",
  label: "Dorico",
  hideChartStavesAfterChart: true,
  systemBreakAfterChart: true,
  chartStaffSizePercent: 80,
  implicitMeasureNumber: "0",
  columnsPerMeasure: "all",
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
