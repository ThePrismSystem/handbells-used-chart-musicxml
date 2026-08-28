export interface TargetProfile {
  readonly id: string;
  readonly label: string;
  /**
   * "insert" rewrites the score with the chart in it. "flow" writes the chart
   * as a document of its own, to be imported into a project the user already
   * has open — the only option for an application whose engraving would be
   * lost by re-importing the score.
   */
  readonly output: "insert" | "flow";
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
  /**
   * Octaves to shift a bell by to get the pitch written on the chart. In
   * MusicXML <pitch> is the written pitch, so a bell named C6 is written C5
   * under the 8va clef: -1. Dorico instead reads <pitch> as the sounding pitch
   * and drops the notehead by the clef's octave change, which draws the whole
   * chart an octave below the score, so it is handed the bell's own pitch: 0.
   */
  readonly writtenOctaveShift: -1 | 0;
}
