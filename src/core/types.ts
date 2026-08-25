export type Step = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Alter = -2 | -1 | 0 | 1 | 2;

/** A written or sounding pitch, spelled. `octave` uses scientific notation, C4 = middle C. */
export interface Pitch {
  readonly step: Step;
  readonly alter: Alter;
  readonly octave: number;
}

export type ChartKind = "bells" | "chimes" | "smbs";

/**
 * Which row of the chart a bell sits on. The three treble regions stack into
 * shared columns, as do the two low bass regions; `bassStaff` stands alone.
 */
export type Region =
  "bassRow2" | "bassRow1" | "bassStaff" | "trebleStaff" | "trebleRow1" | "trebleRow2";

/** How a part's written pitch relates to the bell name it denotes. */
export type OctaveConvention = "written-octave-below" | "at-bell-name";

/** One note as read from the score, before any octave convention is applied. */
export interface RawNote {
  readonly pitch: Pitch;
  readonly notehead: string;
  readonly partId: string;
}

/** One note after its part's convention has been applied: pitch is the bell's name. */
export interface BellRecord {
  readonly pitch: Pitch;
  readonly midi: number;
  readonly notehead: string;
}

/** One distinct bell on the chart, with how many times the score uses it. */
export interface ChartEntry {
  readonly pitch: Pitch;
  readonly midi: number;
  readonly name: string;
  readonly region: Region;
  count: number;
}
