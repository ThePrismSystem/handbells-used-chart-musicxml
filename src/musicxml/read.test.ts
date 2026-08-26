import { describe, expect, it } from "vitest";

import { parseScore } from "./document.js";
import { readScore } from "./read.js";

const note = (step: string, octave: string, extra = ""): string =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
  `<duration>1</duration>${extra}</note>`;

const build = (partList: string, parts: string): Document =>
  parseScore(
    `<score-partwise version="4.0"><part-list>${partList}</part-list>${parts}</score-partwise>`,
  ).doc;

const simple = (body: string, scorePart = "<part-name>Handbells</part-name>"): Document =>
  build(
    `<score-part id="P1">${scorePart}</score-part>`,
    `<part id="P1"><measure number="1">${body}</measure></part>`,
  );

describe("readScore", () => {
  it("reads step, alter and octave", () => {
    const doc = simple(
      "<note><pitch><step>G</step><alter>1</alter><octave>4</octave></pitch>" +
        "<duration>1</duration></note>",
    );
    expect(readScore(doc).notes[0]?.pitch).toEqual({ step: "G", alter: 1, octave: 4 });
  });

  it("defaults a missing alter to natural", () => {
    expect(readScore(simple(note("C", "4"))).notes[0]?.pitch.alter).toBe(0);
  });

  it("defaults a missing notehead to normal", () => {
    expect(readScore(simple(note("C", "4"))).notes[0]?.notehead).toBe("normal");
  });

  it("reads the notehead when present", () => {
    const doc = simple(note("C", "4", "<notehead>diamond</notehead>"));
    expect(readScore(doc).notes[0]?.notehead).toBe("diamond");
  });

  it("tags each note with its part", () => {
    expect(readScore(simple(note("C", "4"))).notes[0]?.partId).toBe("P1");
  });

  it("skips rests and unpitched notes without calling them errors", () => {
    const doc = simple(
      "<note><rest/><duration>1</duration></note>" +
        "<note><unpitched><display-step>C</display-step>" +
        "<display-octave>4</display-octave></unpitched><duration>1</duration></note>" +
        note("C", "4"),
    );
    const result = readScore(doc);
    expect(result.notes).toHaveLength(1);
    expect(result.unreadable).toBe(0);
  });

  it("counts a microtonal alter as unreadable", () => {
    const doc = simple(
      "<note><pitch><step>C</step><alter>0.5</alter><octave>4</octave></pitch>" +
        "<duration>1</duration></note>",
    );
    const result = readScore(doc);
    expect(result.notes).toHaveLength(0);
    expect(result.unreadable).toBe(1);
  });

  it("counts a nonsense step as unreadable", () => {
    const doc = simple(
      "<note><pitch><step>H</step><octave>4</octave></pitch><duration>1</duration></note>",
    );
    expect(readScore(doc).unreadable).toBe(1);
  });

  it("counts a pitch with no octave as unreadable", () => {
    // Number(null) is 0, and 0 is a legal octave, so without an explicit null
    // check this note reads as a silent C0 bell instead of being counted.
    const doc = simple("<note><pitch><step>C</step></pitch><duration>1</duration></note>");
    const result = readScore(doc);
    expect(result.notes).toHaveLength(0);
    expect(result.unreadable).toBe(1);
  });

  it("counts every notehead it saw", () => {
    const doc = simple(
      note("C", "4") +
        note("D", "4", "<notehead>diamond</notehead>") +
        note("E", "4", "<notehead>diamond</notehead>"),
    );
    expect(readScore(doc).noteheadCounts.get("normal")).toBe(1);
    expect(readScore(doc).noteheadCounts.get("diamond")).toBe(2);
  });

  it("reports each part with its detected convention and reason", () => {
    const doc = simple(
      note("C", "4"),
      "<part-name>Handbells</part-name>" +
        '<score-instrument id="I1"><instrument-name>Handbells</instrument-name>' +
        "<instrument-sound>pitched-percussion.handbells</instrument-sound></score-instrument>",
    );
    const [part] = readScore(doc).parts;
    expect(part?.id).toBe("P1");
    expect(part?.name).toBe("Handbells");
    expect(part?.noteCount).toBe(1);
    expect(part?.reason).toContain("pitched-percussion.handbells");
  });

  it("reads a part's octave transposition", () => {
    const doc = build(
      '<score-part id="P1"><part-name>Handbells</part-name></score-part>',
      '<part id="P1"><measure number="1"><attributes><transpose>' +
        "<diatonic>0</diatonic><chromatic>0</chromatic><octave-change>1</octave-change>" +
        `</transpose></attributes>${note("C", "4")}</measure></part>`,
    );
    expect(readScore(doc).parts[0]?.reason).toContain("<transpose>");
  });

  it("skips a chart part's own notes so a re-run cannot double-count", () => {
    const doc = build(
      '<score-part id="HBC1"><part-name>Handbells Used Chart</part-name></score-part>' +
        '<score-part id="P1"><part-name>Piano</part-name></score-part>',
      `<part id="HBC1"><measure number="0">${note("C", "5")}</measure></part>` +
        `<part id="P1"><measure number="0"/><measure number="1">${note("C", "4")}</measure></part>`,
    );
    const result = readScore(doc);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.partId).toBe("P1");
    expect(result.parts.map((p) => p.id)).toEqual(["P1"]);
    expect(result.existingChart?.partIds).toEqual(["HBC1"]);
  });

  it("reports no existing chart for a plain score", () => {
    expect(readScore(simple(note("C", "4"))).existingChart).toBeNull();
  });

  it("reads a part that has no matching score-part", () => {
    // signalsFor guards against a part-list that disagrees with the body,
    // which a buggy exporter can produce. Without the guard, text() would be
    // handed null and throw, so the whole file would fail to open rather than
    // losing one part's name.
    const doc = build(
      '<score-part id="P1"><part-name>Handbells</part-name></score-part>',
      `<part id="P2"><measure number="1">${note("C", "4")}</measure></part>`,
    );
    const [part] = readScore(doc).parts;
    expect(part?.id).toBe("P2");
    expect(part?.name).toBe("");
    expect(part?.reason).toContain("no signal");
  });

  it("reads a score-part that carries no part-name", () => {
    // The milder sibling of the case above: the score-part exists but the
    // schema-required <part-name> is missing. Reading an unnamed part as ""
    // keeps the file open; the part simply falls to the no-signal default.
    const doc = build(
      '<score-part id="P1"/>',
      `<part id="P1"><measure number="1">${note("C", "4")}</measure></part>`,
    );
    const [part] = readScore(doc).parts;
    expect(part?.name).toBe("");
    expect(part?.noteCount).toBe(1);
  });

  it("returns empty results for a score with no parts", () => {
    const doc = build("", "");
    expect(readScore(doc)).toMatchObject({ parts: [], notes: [], unreadable: 0 });
  });
});
