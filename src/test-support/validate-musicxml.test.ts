import { describe, expect, it } from "vitest";

import { validateMusicXml } from "./validate-musicxml.js";

const VALID = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Handbells</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><rest/><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("validateMusicXml", () => {
  it("accepts a valid score", async () => {
    expect(await validateMusicXml(VALID)).toEqual([]);
  });

  it("rejects an element the schema does not allow", async () => {
    const bad = VALID.replace("<rest/>", "<rest/><nonsense/>");
    expect(await validateMusicXml(bad)).not.toEqual([]);
  });

  it("rejects a lower-case colour, which the color pattern forbids", async () => {
    // This is one of the two bugs that motivated the harness.
    const bad = VALID.replace("<note><rest/>", '<note color="#c00000"><rest/>');
    expect(await validateMusicXml(bad)).not.toEqual([]);
  });

  it("rejects print-object on accidental, which has no such attribute", async () => {
    const bad = VALID.replace(
      "<note><rest/><duration>4</duration></note>",
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration>" +
        '<accidental print-object="no">natural</accidental></note>',
    );
    expect(await validateMusicXml(bad)).not.toEqual([]);
  });
});
