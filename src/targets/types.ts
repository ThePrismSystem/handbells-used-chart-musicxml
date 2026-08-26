import type { ChartPlan } from "../core/plan.js";

export interface TargetProfile {
  readonly id: string;
  readonly label: string;
  /** Emit <staff-details print-object="no"> so chart staves vanish under the music. */
  readonly hideChartStavesAfterChart: boolean;
  /** Emit <print new-system="yes"> on the first measure of the music. */
  readonly systemBreakAfterChart: boolean;
  /** <staff-size> for chart staves, or null to leave it to the application. */
  readonly chartStaffSizePercent: number | null;
  /** What the chart bar is numbered. It is implicit, so this never renumbers the piece. */
  readonly implicitMeasureNumber: string;
  /**
   * "all" puts every column in one measure. A number puts that many columns in
   * each, which resets accidental state per measure — the fallback if an
   * importer re-derives accidentals rather than honouring <accidental>.
   */
  readonly columnsPerMeasure: number | "all";
  /**
   * How the chart's 8va convention is expressed. "clef" writes only
   * <clef-octave-change>; "clef+transpose" adds <transpose>. Emitting both
   * risks an importer counting the octave twice.
   */
  readonly octaveVia: "clef" | "clef+transpose";
  /** Escape hatch for a target that needs genuine surgery. */
  readonly postProcess?: (doc: Document, plan: ChartPlan) => void;
}
