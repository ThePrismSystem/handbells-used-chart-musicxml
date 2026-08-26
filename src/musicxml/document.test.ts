import { describe, expect, it } from "vitest";

import { ScoreParseError, cloneScore, parseScore, serializeScore } from "./document.js";

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" ' +
  '"http://www.musicxml.org/dtds/partwise.dtd">';

const MINIMAL = `${DECLARATION}
${DOCTYPE}
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Handbells</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1"><note><rest/><duration>4</duration></note></measure>
  </part>
</score-partwise>`;

describe("parseScore", () => {
  it("parses a well-formed partwise score", () => {
    const parsed = parseScore(MINIMAL);
    expect(parsed.doc.documentElement.nodeName).toBe("score-partwise");
  });

  it("captures the declaration and the doctype", () => {
    const parsed = parseScore(MINIMAL);
    expect(parsed.declaration).toBe(DECLARATION);
    expect(parsed.doctype).toBe(DOCTYPE);
  });

  it("tolerates a file with neither", () => {
    const parsed = parseScore("<score-partwise><part-list/></score-partwise>");
    expect(parsed.declaration).toBeNull();
    expect(parsed.doctype).toBeNull();
  });

  it("refuses malformed XML", () => {
    // DOMParser returns a <parsererror> document rather than throwing.
    expect(() => parseScore("<score-partwise><oops></score-partwise>")).toThrow(ScoreParseError);
  });

  it("refuses a document that is not XML at all", () => {
    expect(() => parseScore("this is not xml")).toThrow(ScoreParseError);
  });

  it("refuses a timewise score by name", () => {
    expect(() => parseScore("<score-timewise><part-list/></score-timewise>")).toThrow(
      /score-timewise/,
    );
  });
});

describe("serializeScore", () => {
  it("round-trips the declaration and doctype exactly once each", () => {
    const output = serializeScore(parseScore(MINIMAL));
    expect(output.split("<?xml")).toHaveLength(2);
    expect(output.split("<!DOCTYPE")).toHaveLength(2);
    expect(output.startsWith(DECLARATION)).toBe(true);
  });

  it("keeps the score's content", () => {
    const output = serializeScore(parseScore(MINIMAL));
    expect(output).toContain('<score-part id="P1">');
    expect(output).toContain("<part-name>Handbells</part-name>");
  });

  it("ends with a newline", () => {
    expect(serializeScore(parseScore(MINIMAL)).endsWith("\n")).toBe(true);
  });

  it("serialises a document other than the one that was parsed", () => {
    const parsed = parseScore(MINIMAL);
    const clone = cloneScore(parsed);
    clone.documentElement.setAttribute("version", "3.1");
    expect(serializeScore(parsed, clone)).toContain('version="3.1"');
    expect(serializeScore(parsed)).toContain('version="4.0"');
  });
});

describe("cloneScore", () => {
  it("returns a document that can be edited without touching the original", () => {
    // Emission always works on a clone, so a failed run cannot leave a
    // half-edited score and repeated downloads cannot accumulate chart parts.
    const parsed = parseScore(MINIMAL);
    const clone = cloneScore(parsed);
    clone.documentElement.remove();
    expect(parsed.doc.documentElement.nodeName).toBe("score-partwise");
  });
});
