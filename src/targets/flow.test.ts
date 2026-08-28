import { describe, expect, it } from "vitest";

import { DEFAULT_HEAD_MAPPING } from "../core/collect.js";
import { toMidi } from "../core/pitch.js";
import { buildPlan } from "../core/plan.js";
import { parseScore } from "../musicxml/document.js";
import { validateMusicXml } from "../test-support/validate-musicxml.js";

import { emitChartFlow } from "./flow.js";
import { DORICO, GENERIC } from "./profiles.js";

import type { BellRecord, Pitch } from "../core/types.js";

const bell = (
  step: Pitch["step"],
  alter: Pitch["alter"],
  octave: number,
  notehead = "normal",
): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead };
};

const flowFor = (records: BellRecord[], profile = DORICO) =>
  emitChartFlow(buildPlan(records, { headMapping: DEFAULT_HEAD_MAPPING }), profile);

const docFor = (records: BellRecord[], profile = DORICO): Document =>
  parseScore(flowFor(records, profile) ?? "").doc;

describe("emitChartFlow", () => {
  it("produces a schema-valid document", async () => {
    const xml = flowFor([bell("C", 0, 5), bell("G", 1, 6), bell("D", 0, 6, "diamond")]);
    expect(await validateMusicXml(xml ?? "")).toEqual([]);
  });

  it("stays schema-valid for a one-staff section with a colour", async () => {
    const plan = buildPlan([bell("D", 0, 6, "diamond"), bell("E", 0, 6, "la")], {
      headMapping: DEFAULT_HEAD_MAPPING,
      chimeColor: "#c00000",
      smbColor: "#0000ff",
    });
    expect(await validateMusicXml(emitChartFlow(plan, DORICO) ?? "")).toEqual([]);
  });

  it("carries the chart and nothing else", () => {
    // The whole point of the flow output: the score is never touched, so the
    // document holds no music part to touch. A music part appearing here would
    // mean the user's score had been round-tripped after all.
    const doc = docFor([bell("C", 0, 5), bell("D", 0, 6, "diamond")]);
    const names = [...doc.querySelectorAll("part-list > score-part > part-name")].map(
      (name) => name.textContent,
    );
    expect(names).toEqual(["Handbells Used Chart", "Handchimes Used Chart"]);
    expect(doc.querySelectorAll("score-partwise > part")).toHaveLength(2);
  });

  it("states an open metre rather than hiding a counted one", () => {
    // A hidden time signature is a hidden item, which Dorico marks with a
    // signpost the user then has to find and delete. senza-misura is not a
    // hidden signature; it is the absence of one, so there is nothing to mark.
    const doc = docFor([bell("C", 0, 5)]);
    const time = doc.querySelector('part[id="HBC1"] > measure > attributes > time');
    expect(time?.querySelector("senza-misura")).not.toBeNull();
    expect(time?.hasAttribute("print-object")).toBe(false);
    expect(time?.querySelector("beats")).toBeNull();
  });

  it("writes a plain C major key rather than a hidden one", () => {
    // C major draws nothing on its own, so hiding it buys nothing and costs a
    // signpost. Omitting the key entirely is worse still: a reader takes that
    // as atonal and prints a key change at the first bar that has one.
    const key = docFor([bell("C", 0, 5)]).querySelector('part[id="HBC1"] key');
    expect(key?.querySelector("fifths")?.textContent).toBe("0");
    expect(key?.hasAttribute("print-object")).toBe(false);
  });

  it("gives each column its own bar under columnsPerMeasure 1", () => {
    const doc = docFor([bell("C", 0, 6), bell("E", 0, 6), bell("G", 0, 6)]);
    expect(doc.querySelectorAll('part[id="HBC1"] > measure')).toHaveLength(3);
  });

  it("puts every column in one bar under columnsPerMeasure all", () => {
    // GENERIC is the profile that does not split, so the two arms of the
    // splitting arithmetic are both covered.
    const doc = docFor([bell("C", 0, 6), bell("E", 0, 6), bell("G", 0, 6)], GENERIC);
    const measures = doc.querySelectorAll('part[id="HBC1"] > measure');
    expect(measures).toHaveLength(1);
    // All three columns land in that one bar. Counting pitched notes rather
    // than notes keeps the bass staff's padding rests out of the total.
    const pitched = [...doc.querySelectorAll('part[id="HBC1"] > measure > note')].filter(
      (note) => note.querySelector("pitch") !== null,
    );
    expect(pitched).toHaveLength(3);
  });

  it("draws no barlines between the columns", () => {
    const doc = docFor([bell("C", 0, 6), bell("E", 0, 6)]);
    const styles = [...doc.querySelectorAll('part[id="HBC1"] barline > bar-style')].map(
      (style) => style.textContent,
    );
    expect(styles).toEqual(["none", "none"]);
  });

  it("labels each section above its staves", () => {
    const doc = docFor([bell("C", 0, 5), bell("D", 0, 6, "diamond")]);
    const words = [...doc.querySelectorAll("direction words")].map((w) => w.textContent);
    expect(words).toEqual(["Handbells Used: 1", "Handchimes Used: 1"]);
  });

  it("titles the flow so Dorico names it in the Flows panel", () => {
    expect(docFor([bell("C", 0, 5)]).querySelector("movement-title")?.textContent).toBe(
      "Handbells Used Chart",
    );
  });

  it("pads a narrower section so the sections stay in step", async () => {
    // The bells and chimes staves are read as columns across, so a chimes
    // section shorter than the bells one has to hold its place.
    const xml = flowFor([
      bell("C", 0, 6),
      bell("E", 0, 6),
      bell("G", 0, 6),
      bell("D", 0, 6, "diamond"),
    ]);
    expect(await validateMusicXml(xml ?? "")).toEqual([]);
    const doc = parseScore(xml ?? "").doc;
    expect(doc.querySelectorAll('part[id="HBC2"] > measure')).toHaveLength(3);
  });

  it("has nothing to write for a score with no bells in it", () => {
    // A chart document with no parts in it is not valid MusicXML, so an empty
    // plan cannot produce a file at all — the caller must offer no download.
    expect(emitChartFlow(buildPlan([], { headMapping: DEFAULT_HEAD_MAPPING }), DORICO)).toBeNull();
  });
});
