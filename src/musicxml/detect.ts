import type { OctaveConvention } from "../core/types.js";

export interface PartSignals {
  readonly id: string;
  readonly name: string;
  readonly instrumentSound: string | null;
  readonly octaveChange: number | null;
}

export interface Detection {
  readonly convention: OctaveConvention;
  readonly reason: string;
}

/** Standard MusicXML instrument sounds; handchimes was added in 4.0. */
const HANDBELL_SOUNDS = new Set(["pitched-percussion.handbells", "pitched-percussion.handchimes"]);

const HANDBELL_NAME = /hand[\s-]?(?:bell|chime)/i;

export function detectConvention(signals: PartSignals): Detection {
  const sound = signals.instrumentSound;

  if (sound !== null && HANDBELL_SOUNDS.has(sound)) {
    if (signals.octaveChange === 1) {
      return {
        convention: "written-octave-below",
        reason: `instrument-sound: ${sound}, with a <transpose> of one octave`,
      };
    }
    // The instrument is a handbell instrument but carries no transposition, so
    // its written pitches are already the sounding ones.
    return {
      convention: "at-bell-name",
      reason: `instrument-sound: ${sound}, but no <transpose> — pitches read as sounding`,
    };
  }

  if (signals.octaveChange === 1) {
    return {
      convention: "written-octave-below",
      reason: "<transpose> of one octave up",
    };
  }

  if (HANDBELL_NAME.test(signals.name)) {
    return {
      convention: "written-octave-below",
      reason: `part name "${signals.name}"`,
    };
  }

  return {
    convention: "written-octave-below",
    reason: "no signal; assumed handbell convention",
  };
}
