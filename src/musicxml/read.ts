import { detectConvention } from "./detect.js";
import { findChart } from "./marker.js";

import type { ExistingChart } from "./marker.js";
import type { Alter, OctaveConvention, Pitch, RawNote, Step } from "../core/types.js";

export interface PartInfo {
  readonly id: string;
  readonly name: string;
  readonly convention: OctaveConvention;
  readonly reason: string;
  readonly noteCount: number;
}

export interface ReadResult {
  readonly parts: PartInfo[];
  readonly notes: RawNote[];
  readonly noteheadCounts: Map<string, number>;
  readonly existingChart: ExistingChart | null;
  readonly unreadable: number;
}

const STEPS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const ALTERS = new Set([-2, -1, 0, 1, 2]);

const isStep = (value: string): value is Step => STEPS.has(value);
const isAlter = (value: number): value is Alter => ALTERS.has(value);

function text(parent: Element, selector: string): string | null {
  return parent.querySelector(selector)?.textContent.trim() ?? null;
}

/** Takes the <pitch> element itself: the caller has already found it. */
function readPitch(pitch: Element): Pitch | null {
  const step = text(pitch, ":scope > step");
  const rawOctave = text(pitch, ":scope > octave");
  const octave = Number(rawOctave);
  const rawAlter = text(pitch, ":scope > alter");
  const alter = rawAlter === null ? 0 : Number(rawAlter);

  // rawOctave is checked separately because Number(null) is 0 and 0 is a legal
  // octave: without it, a pitch missing <octave> reads as a silent C0 bell.
  if (step === null || !isStep(step) || rawOctave === null || !Number.isInteger(octave)) {
    return null;
  }
  // Quarter-tone alterations are decimal and have no chart to go on.
  if (!Number.isInteger(alter) || !isAlter(alter)) {
    return null;
  }
  return { step, alter, octave };
}

function signalsFor(doc: Document, part: Element, id: string) {
  const scorePart = doc.querySelector(`part-list > score-part[id="${id}"]`);
  const octaveChange = text(part, "attributes > transpose > octave-change");
  return {
    id,
    name: scorePart === null ? "" : (text(scorePart, ":scope > part-name") ?? ""),
    instrumentSound:
      scorePart === null ? null : text(scorePart, "score-instrument > instrument-sound"),
    octaveChange: octaveChange === null ? null : Number(octaveChange),
  };
}

export function readScore(doc: Document): ReadResult {
  const existingChart = findChart(doc);
  const chartIds = new Set(existingChart?.partIds ?? []);

  const parts: PartInfo[] = [];
  const notes: RawNote[] = [];
  const noteheadCounts = new Map<string, number>();
  let unreadable = 0;

  for (const part of doc.querySelectorAll("score-partwise > part")) {
    const id = part.getAttribute("id");
    // A chart part's own notes must never feed the next chart.
    if (id === null || chartIds.has(id)) {
      continue;
    }

    let noteCount = 0;
    for (const note of part.querySelectorAll("measure > note")) {
      // Rests and unpitched percussion are not errors; they simply have no
      // bell to name.
      if (note.querySelector(":scope > rest") !== null) {
        continue;
      }
      const pitchElement = note.querySelector(":scope > pitch");
      if (pitchElement === null) {
        continue;
      }

      const pitch = readPitch(pitchElement);
      if (pitch === null) {
        unreadable++;
        continue;
      }

      const notehead = text(note, ":scope > notehead") ?? "normal";
      noteheadCounts.set(notehead, (noteheadCounts.get(notehead) ?? 0) + 1);
      notes.push({ pitch, notehead, partId: id });
      noteCount++;
    }

    const signals = signalsFor(doc, part, id);
    const detection = detectConvention(signals);
    parts.push({
      id,
      name: signals.name,
      convention: detection.convention,
      reason: detection.reason,
      noteCount,
    });
  }

  return { parts, notes, noteheadCounts, existingChart, unreadable };
}
