import type { Alter, Pitch, Region, Step } from "./types.js";

/** Semitones above C for each natural letter. */
const STEP_SEMITONE: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Position of each letter within an octave, ignoring accidentals. */
const STEP_INDEX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const ACCIDENTAL_TEXT: Record<Alter, string> = {
  [-2]: "bb",
  [-1]: "b",
  [0]: "",
  [1]: "#",
  [2]: "x",
};

const SEMITONES_PER_OCTAVE = 12;
const STEPS_PER_OCTAVE = 7;

/**
 * Written longest-first only for readability. What the parse actually depends
 * on is the digit check below: without it "C5x" yields NaN and "C-1" yields a
 * pitch of 0, instead of both being refused.
 */
const ACCIDENTALS: readonly { readonly text: string; readonly alter: Alter }[] = [
  { text: "bb", alter: -2 },
  { text: "x", alter: 2 },
  { text: "b", alter: -1 },
  { text: "#", alter: 1 },
  { text: "", alter: 0 },
];

/**
 * The six chart rows, as contiguous diatonic-index ranges covering C2 to C9.
 * Diatonic rather than sounding pitch, so a region holds a letter and all its
 * spellings.
 */
const REGIONS: readonly { readonly name: Region; readonly min: number; readonly max: number }[] = [
  { name: "bassRow2", min: 14, max: 20 }, // C2 - B2
  { name: "bassRow1", min: 21, max: 27 }, // C3 - B3
  { name: "bassStaff", min: 28, max: 35 }, // C4 - C5
  { name: "trebleStaff", min: 36, max: 49 }, // D5 - C7
  { name: "trebleRow1", min: 50, max: 56 }, // D7 - C8
  { name: "trebleRow2", min: 57, max: 63 }, // D8 - C9
];

/**
 * Silver melody bells are made in one size only: the two chromatic octaves
 * from C5 to C7. Sounding pitch rather than diatonic index, because the
 * regions above cannot express it — diatonic ignores the accidental, so C7 and
 * C#7 share a band and a table could not admit the one and refuse the other.
 */
export const SMB_COMPASS = { min: 72, max: 96 } as const;

const isStep = (value: string): value is Step =>
  Object.prototype.hasOwnProperty.call(STEP_SEMITONE, value);

export function toMidi(pitch: Pitch): number {
  return (pitch.octave + 1) * SEMITONES_PER_OCTAVE + STEP_SEMITONE[pitch.step] + pitch.alter;
}

export function toName(pitch: Pitch): string {
  return `${pitch.step}${ACCIDENTAL_TEXT[pitch.alter]}${String(pitch.octave)}`;
}

export function diatonic(pitch: Pitch): number {
  return pitch.octave * STEPS_PER_OCTAVE + STEP_INDEX[pitch.step];
}

export function addOctaves(pitch: Pitch, octaves: number): Pitch {
  return { step: pitch.step, alter: pitch.alter, octave: pitch.octave + octaves };
}

function refuse(name: string, noun: string): Error {
  return new Error(
    `"${name}" is not a ${noun} name. Use a letter, an optional accidental and ` +
      `an octave, as the chart prints them — for example C6, Ab3 or F#7.`,
  );
}

/**
 * The letter is matched case-insensitively because someone typing "c6" means
 * C6. The accidental is not: "B" and "b" are a letter and a flat, and folding
 * case would make "Bb" ambiguous with "BB".
 */
export function parseName(name: string, noun = "bell"): Pitch {
  const text = name.trim();
  if (text === "") {
    throw refuse(name, noun);
  }

  const letter = text.charAt(0).toUpperCase();
  if (!isStep(letter)) {
    throw refuse(name, noun);
  }

  const rest = text.slice(1);
  for (const accidental of ACCIDENTALS) {
    if (rest.slice(0, accidental.text.length) !== accidental.text) {
      continue;
    }
    const digits = rest.slice(accidental.text.length);
    if (!/^\d+$/.test(digits)) {
      continue;
    }
    return { step: letter, alter: accidental.alter, octave: Number(digits) };
  }
  throw refuse(name, noun);
}

export function regionOf(pitch: Pitch): Region | null {
  const index = diatonic(pitch);
  for (const region of REGIONS) {
    if (index >= region.min && index <= region.max) {
      return region.name;
    }
  }
  return null;
}
