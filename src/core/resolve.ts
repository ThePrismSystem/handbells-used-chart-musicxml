import { addOctaves, toMidi } from "./pitch.js";

import type { BellRecord, OctaveConvention, RawNote } from "./types.js";

/**
 * MusicXML stores written pitch. A bell's name is its written pitch plus one
 * octave, when the part follows handbell convention — which most handbell
 * music does, and which is therefore the fallback for a part the reader could
 * not classify.
 */
export function resolveBells(
  notes: readonly RawNote[],
  conventions: ReadonlyMap<string, OctaveConvention>,
): BellRecord[] {
  return notes.map((note) => {
    const convention = conventions.get(note.partId) ?? "written-octave-below";
    const pitch = convention === "written-octave-below" ? addOctaves(note.pitch, 1) : note.pitch;
    return { pitch, midi: toMidi(pitch), notehead: note.notehead };
  });
}
