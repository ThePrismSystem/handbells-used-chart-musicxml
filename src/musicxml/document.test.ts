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
    // The message matters: jsdom makes <parsererror> the ROOT element, so a
    // regression that dropped the explicit check would still throw here, but
    // would report the root as <parsererror> instead of naming the real fault.
    expect(() => parseScore("<score-partwise><oops></score-partwise>")).toThrow(ScoreParseError);
    expect(() => parseScore("<score-partwise><oops></score-partwise>")).toThrow(/not valid XML/);
  });

  it("refuses a document that is not XML at all", () => {
    expect(() => parseScore("this is not xml")).toThrow(ScoreParseError);
    expect(() => parseScore("this is not xml")).toThrow(/not valid XML/);
  });

  it("refuses a timewise score by name", () => {
    // Assert the guidance, not the format name: the generic wrong-root message
    // interpolates the root and so also contains "score-timewise". Only this
    // phrase proves the dedicated branch — and its advice — still exists.
    expect(() => parseScore("<score-timewise><part-list/></score-timewise>")).toThrow(
      /re-export it as partwise/,
    );
  });

  it("refuses a well-formed XML file that is not a score", () => {
    // Distinct from the malformed and timewise cases: this parses cleanly and
    // is rejected on its root element alone.
    expect(() => parseScore("<html><body/></html>")).toThrow(ScoreParseError);
    expect(() => parseScore("<html><body/></html>")).toThrow(/not a MusicXML score/);
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

  it("prepends the doctype when the serialiser leaves it out", () => {
    // jsdom's XMLSerializer emits the doctype, so the round-trip test never
    // reaches this branch. Some browser serialisers do not, and then the
    // doctype has to be prepended by hand — that is what this pins.
    const parsed = parseScore(MINIMAL);
    const withoutDoctype = parseScore("<score-partwise><part-list/></score-partwise>").doc;
    const output = serializeScore(parsed, withoutDoctype);
    expect(output.split("<!DOCTYPE").length - 1).toBe(1);
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
