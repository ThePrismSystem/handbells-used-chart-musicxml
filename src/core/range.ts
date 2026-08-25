import { parseName, toMidi } from "./pitch.js";

export interface BellRange {
  readonly first: number | null;
  readonly last: number | null;
}

function isPresent(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "";
}

/**
 * Converting names to sounding pitch here, once, is what keeps a range from
 * having to know about spelling.
 */
export function bellRange(
  first: string | null | undefined,
  last: string | null | undefined,
  noun = "bell",
): BellRange {
  const range: BellRange = {
    first: isPresent(first) ? toMidi(parseName(first, noun)) : null,
    last: isPresent(last) ? toMidi(parseName(last, noun)) : null,
  };
  if (range.first !== null && range.last !== null && range.first > range.last) {
    throw new Error(
      `The first required ${noun} (${String(first)}) sounds above the last (${String(last)}).`,
    );
  }
  return range;
}

export function isOptional(range: BellRange, midi: number): boolean {
  if (range.first !== null && midi < range.first) {
    return true;
  }
  return range.last !== null && midi > range.last;
}
