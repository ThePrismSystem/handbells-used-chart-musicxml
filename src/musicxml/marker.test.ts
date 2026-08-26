import { describe, expect, it } from "vitest";

import { parseScore } from "./document.js";
import { findChart, removeChart, writeMarker } from "./marker.js";

const score = (partList: string, parts: string): string =>
  `<score-partwise version="4.0"><part-list>${partList}</part-list>${parts}</score-partwise>`;

const measure = (n: string, body = "") => `<measure number="${n}">${body}</measure>`;

const plain = (): Document =>
  parseScore(
    score(
      '<score-part id="P1"><part-name>Piano</part-name></score-part>',
      `<part id="P1">${measure("1")}${measure("2")}</part>`,
    ),
  ).doc;

const charted = (): Document =>
  parseScore(
    score(
      '<score-part id="HBC1"><part-name>Handbells Used Chart</part-name></score-part>' +
        '<score-part id="P1"><part-name>Piano</part-name></score-part>',
      `<part id="HBC1">${measure("0")}${measure("1")}${measure("2")}</part>` +
        `<part id="P1">${measure("0")}${measure("1", '<print new-system="yes"/>')}${measure("2")}</part>`,
    ),
  ).doc;

describe("findChart", () => {
  it("returns null for a score with no chart", () => {
    expect(findChart(plain())).toBeNull();
  });

  it("reads the marker fields when present", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    expect(findChart(doc)).toEqual({ partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
  });

  it("falls back to the part name when the fields are gone", () => {
    // A chart round-tripped through another application may lose its
    // miscellaneous-fields but keep its part name.
    expect(findChart(charted())).toEqual({ partIds: ["HBC1"], measures: 1, printParts: [] });
  });

  it("treats a nonsense measure count as one measure", () => {
    // The marker is data read back from a file other applications may have
    // edited by hand, so a corrupt count must not reach removeChart and
    // become slice(0, NaN). This is the boundary the guard exists for.
    const doc = parseScore(
      `<score-partwise version="4.0"><identification><miscellaneous>` +
        `<miscellaneous-field name="handbellChartParts">HBC1</miscellaneous-field>` +
        `<miscellaneous-field name="handbellChartMeasures">not a number</miscellaneous-field>` +
        `</miscellaneous></identification><part-list/></score-partwise>`,
    ).doc;
    expect(findChart(doc)).toEqual({ partIds: ["HBC1"], measures: 1, printParts: [] });
  });
});

describe("removeChart", () => {
  it("reports that there was nothing to remove", () => {
    const doc = plain();
    expect(removeChart(doc)).toBe(false);
    expect(doc.getElementsByTagName("measure")).toHaveLength(2);
  });

  it("removes the chart part from the part-list and the body", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    expect(removeChart(doc)).toBe(true);
    expect(doc.querySelector('score-part[id="HBC1"]')).toBeNull();
    expect(doc.querySelector('part[id="HBC1"]')).toBeNull();
  });

  it("removes the leading measures it added from every remaining part", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    removeChart(doc);
    const measures = doc.querySelectorAll('part[id="P1"] > measure');
    expect([...measures].map((m) => m.getAttribute("number"))).toEqual(["1", "2"]);
  });

  it("removes the system break it added", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    removeChart(doc);
    expect(doc.querySelector("print")).toBeNull();
  });

  it("leaves a system break it did not add", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: [] });
    removeChart(doc);
    expect(doc.querySelector("print")).not.toBeNull();
  });

  it("leaves a print that carries layout of its own", () => {
    // The test above protects a part removal was never told about. This one
    // protects a part it WAS told about, whose print turns out not to be
    // ours: insertion only ever writes a bare <print new-system="yes"/>, so a
    // print with children came from the score and must survive. Without this,
    // the children.length check could be deleted and nothing would notice.
    const doc = parseScore(
      score(
        '<score-part id="HBC1"><part-name>Handbells Used Chart</part-name></score-part>' +
          '<score-part id="P1"><part-name>Piano</part-name></score-part>',
        `<part id="HBC1">${measure("0")}${measure("1")}</part>` +
          `<part id="P1">${measure("0")}${measure("1", '<print new-system="yes"><system-layout/></print>')}</part>`,
      ),
    ).doc;
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    removeChart(doc);
    expect(doc.querySelector("print")).not.toBeNull();
  });

  it("removes a chart identified only by its part name", () => {
    // findChart has a part-name fallback for charts round-tripped through
    // another application, but nothing exercised removeChart along it — the
    // path a user actually takes when they re-upload a score they edited
    // elsewhere. It is also the only case where there are no marker fields
    // to clean up.
    const doc = charted();
    expect(removeChart(doc)).toBe(true);
    expect(doc.querySelector('score-part[id="HBC1"]')).toBeNull();
    expect(doc.querySelector('part[id="HBC1"]')).toBeNull();
    // measures falls back to 1, so P1's leading measure goes with it.
    const measures = doc.querySelectorAll('part[id="P1"] > measure');
    expect([...measures].map((m) => m.getAttribute("number"))).toEqual(["1", "2"]);
  });

  it("removes its own marker fields", () => {
    const doc = charted();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: ["P1"] });
    removeChart(doc);
    expect(doc.querySelector("miscellaneous-field")).toBeNull();
    expect(findChart(doc)).toBeNull();
  });
});

describe("writeMarker", () => {
  it("creates identification and miscellaneous when absent", () => {
    const doc = plain();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: [] });
    expect(doc.querySelector("identification > miscellaneous")).not.toBeNull();
  });

  it("replaces a previous marker rather than adding a second", () => {
    const doc = plain();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: [] });
    writeMarker(doc, { partIds: ["HBC2"], measures: 2, printParts: ["P1"] });
    expect(doc.querySelectorAll("miscellaneous-field")).toHaveLength(3);
    expect(findChart(doc)?.partIds).toEqual(["HBC2"]);
  });

  it("puts identification before part-list, as the schema requires", () => {
    const doc = plain();
    writeMarker(doc, { partIds: ["HBC1"], measures: 1, printParts: [] });
    const children = [...doc.documentElement.children].map((c) => c.nodeName);
    expect(children.indexOf("identification")).toBeLessThan(children.indexOf("part-list"));
  });
});
