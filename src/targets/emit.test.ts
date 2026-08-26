import { describe, expect, it } from "vitest";

import { DEFAULT_HEAD_MAPPING } from "../core/collect.js";
import { toMidi } from "../core/pitch.js";
import { buildPlan } from "../core/plan.js";
import { parseScore, serializeScore } from "../musicxml/document.js";
import { validateMusicXml } from "../test-support/validate-musicxml.js";

import { emitChart } from "./emit.js";
import { DORICO, GENERIC } from "./profiles.js";

import type { ChartPlan } from "../core/plan.js";
import type { BellRecord, Pitch } from "../core/types.js";

const SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><rest/><duration>8</duration></note>
    </measure>
    <measure number="2"><note><rest/><duration>8</duration></note></measure>
  </part>
</score-partwise>`;

const bell = (
  step: Pitch["step"],
  alter: Pitch["alter"],
  octave: number,
  notehead = "normal",
): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead };
};

const planFor = (records: BellRecord[]): ChartPlan =>
  buildPlan(records, { headMapping: DEFAULT_HEAD_MAPPING });

const emitted = (records: BellRecord[], profile = DORICO) => {
  const parsed = parseScore(SOURCE);
  const chart = emitChart(parsed.doc, planFor(records), profile);
  return { doc: parsed.doc, chart, xml: serializeScore(parsed) };
};

describe("emitChart", () => {
  it("produces a schema-valid document", async () => {
    const { xml } = emitted([bell("C", 0, 5), bell("G", 1, 6), bell("D", 0, 6, "diamond")]);
    expect(await validateMusicXml(xml)).toEqual([]);
  });

  it("stays schema-valid with a colour and a one-staff section", async () => {
    const parsed = parseScore(SOURCE);
    const plan = buildPlan([bell("D", 0, 6, "diamond"), bell("E", 0, 6, "la")], {
      headMapping: DEFAULT_HEAD_MAPPING,
      chimeColor: "#c00000",
      smbColor: "#0000ff",
    });
    emitChart(parsed.doc, plan, DORICO);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);
  });

  it("stays schema-valid with every accidental", async () => {
    // accidental-value has flat-flat but no double-flat; the enum is asymmetric.
    const { xml } = emitted([
      bell("C", -2, 5),
      bell("D", -1, 5),
      bell("E", 0, 5),
      bell("F", 1, 5),
      bell("G", 2, 5),
    ]);
    expect(await validateMusicXml(xml)).toEqual([]);
  });

  it("puts the chart parts at the front of the part-list", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const ids = [...doc.querySelectorAll("part-list > score-part")].map((p) =>
      p.getAttribute("id"),
    );
    expect(ids[ids.length - 1]).toBe("P1");
    expect(ids).toHaveLength(2);
  });

  it("names chart parts so a re-run recognises them", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const name = doc.querySelector("part-list > score-part > part-name");
    expect(name?.textContent).toBe("Handbells Used Chart");
    expect(name?.getAttribute("print-object")).toBe("no");
  });

  it("gives one measure to every part, chart and music alike", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    for (const part of doc.querySelectorAll("score-partwise > part")) {
      expect(part.querySelectorAll(":scope > measure")).toHaveLength(3);
    }
  });

  it("marks the chart measure implicit so the piece is not renumbered", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const first = doc.querySelector("score-partwise > part > measure");
    expect(first?.getAttribute("implicit")).toBe("yes");
    expect(first?.getAttribute("number")).toBe("0");
    // "the piece is not renumbered" is the actual guarantee, and asserting it
    // on the chart's own measure does not check it: the music's measures are
    // what must keep their original numbers after a bar is prepended.
    const music = [...doc.querySelectorAll('part[id="P1"] > measure')].map((m) =>
      m.getAttribute("number"),
    );
    expect(music).toEqual(["0", "1", "2"]);
  });

  it("breaks the system before the music", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const music = doc.querySelectorAll('part[id="P1"] > measure')[1];
    expect(music?.querySelector("print")?.getAttribute("new-system")).toBe("yes");
  });

  it("writes chart notes with the canonical head and the schema's child order", () => {
    const { doc } = emitted([bell("G", 1, 6, "diamond")]);
    const note = doc.querySelector('part[id="HBC1"] note');
    const order = [...(note?.children ?? [])].map((c) => c.nodeName);
    expect(order).toEqual([
      "pitch",
      "duration",
      "voice",
      "type",
      "accidental",
      "stem",
      "notehead",
      "staff",
    ]);
    expect(note?.querySelector("notehead")?.textContent).toBe("diamond");
  });

  it("omits the accidental for a natural", () => {
    // <accidental> has no print-object, so a natural is omitted rather than
    // hidden. MusicXML's model is that <accidental> is the print instruction.
    const { doc } = emitted([bell("E", 0, 6)]);
    expect(doc.querySelector('part[id="HBC1"] note > accidental')).toBeNull();
  });

  it("spells a double flat as flat-flat", () => {
    const { doc } = emitted([bell("B", -2, 5)]);
    expect(doc.querySelector('part[id="HBC1"] accidental')?.textContent).toBe("flat-flat");
  });

  it("writes bells an octave below their name, under an 8va clef", () => {
    // C5 the bell is written C4 with <clef-octave-change>1</clef-octave-change>.
    const { doc } = emitted([bell("C", 0, 5)]);
    expect(doc.querySelector('part[id="HBC1"] note > pitch > octave')?.textContent).toBe("4");
    expect(doc.querySelector('part[id="HBC1"] clef > clef-octave-change')?.textContent).toBe("1");
  });

  it("stacks a column's bells with <chord/>", () => {
    const { doc } = emitted([bell("D", 0, 6), bell("D", 0, 7)]);
    const notes = [...doc.querySelectorAll('part[id="HBC1"] measure > note')];
    expect(notes[1]?.firstElementChild?.nodeName).toBe("chord");
  });

  it("separates the two staves with a backup of the full measure", () => {
    const { doc } = emitted([bell("C", 0, 4), bell("D", 0, 6)]);
    const backup = doc.querySelector('part[id="HBC1"] backup > duration');
    expect(backup?.textContent).toBe("2");
  });

  it("gives a one-staff section no brace", () => {
    const { doc } = emitted([bell("E", 0, 6, "la")]);
    expect(doc.querySelector('part[id="HBC1"] staves')?.textContent).toBe("1");
    expect(doc.querySelector('part[id="HBC1"] part-symbol')).toBeNull();
  });

  it("gives a two-staff section a brace", () => {
    // The complement of the test above: without this, deleting the
    // part-symbol line from the emitter breaks no test, and a grand staff
    // would print with no brace joining its halves.
    const { doc } = emitted([bell("C", 0, 4), bell("D", 0, 6)]);
    expect(doc.querySelector('part[id="HBC1"] staves')?.textContent).toBe("2");
    expect(doc.querySelector('part[id="HBC1"] part-symbol')?.textContent).toBe("brace");
  });

  it("writes the label as a direction above the chart", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const words = doc.querySelector('part[id="HBC1"] direction words');
    expect(words?.textContent).toBe("Handbells Used: 1");
    // "above" is half of what this test's name promises, and it is the half
    // that decides whether the label collides with the staff it labels.
    expect(words?.closest("direction")?.getAttribute("placement")).toBe("above");
  });

  it("hides the chart staves from the first measure of the music", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    const music = doc.querySelectorAll('part[id="HBC1"] > measure')[1];
    expect(music?.querySelector("staff-details")?.getAttribute("print-object")).toBe("no");
  });

  it("reports what it created so the marker can be written", () => {
    const { chart } = emitted([bell("C", 0, 5), bell("D", 0, 6, "diamond")]);
    expect(chart.partIds).toEqual(["HBC1", "HBC2"]);
    expect(chart.measures).toBe(1);
    expect(chart.printParts).toEqual(["P1"]);
  });

  it("does nothing to a score with no bells in it", () => {
    const parsed = parseScore(SOURCE);
    const chart = emitChart(parsed.doc, planFor([]), DORICO);
    expect(chart.partIds).toEqual([]);
    expect(parsed.doc.querySelectorAll('part[id="P1"] > measure')).toHaveLength(2);
  });

  it("pads a narrower section to the width of the widest", async () => {
    // All sections share one measure, so the shorter ones need filling.
    const { doc, xml } = emitted([
      bell("C", 0, 4),
      bell("E", 0, 4),
      bell("G", 0, 4),
      bell("D", 0, 6, "diamond"),
    ]);
    expect(await validateMusicXml(xml)).toEqual([]);
    const chime = doc.querySelector('part[id="HBC2"] > measure');
    expect(chime?.querySelectorAll("note")).toHaveLength(6);
  });

  it("puts each column in its own measure under columnsPerMeasure 1", async () => {
    const profile = { ...DORICO, columnsPerMeasure: 1 };
    // All three on the treble staff (D5 and up), so each forms its own
    // column: the bass staff runs only through C5, and column width is the
    // max of the two sides, not their sum.
    const { doc, chart, xml } = emitted(
      [bell("C", 0, 6), bell("E", 0, 6), bell("G", 0, 6)],
      profile,
    );
    expect(await validateMusicXml(xml)).toEqual([]);
    expect(chart.measures).toBe(3);
    expect(doc.querySelectorAll('part[id="P1"] > measure')).toHaveLength(5);
  });

  it("keeps every column when the split leaves a short final measure", async () => {
    // Three columns at two per measure: the second measure holds one column,
    // fewer than the <time> declared in the first. That is legal only because
    // every chart measure is implicit, which is MusicXML's own mechanism for a
    // bar whose duration does not match the governing time signature. The
    // even-split test above never reaches this branch, so a column silently
    // dropped from the short measure would go unnoticed.
    const { doc, chart, xml } = emitted([bell("C", 0, 6), bell("E", 0, 6), bell("G", 0, 6)], {
      ...DORICO,
      columnsPerMeasure: 2,
    });
    expect(await validateMusicXml(xml)).toEqual([]);
    expect(chart.measures).toBe(2);

    const measures = [...doc.querySelectorAll('part[id="HBC1"] > measure')].slice(0, 2);
    expect(measures.every((m) => m.getAttribute("implicit") === "yes")).toBe(true);
    // All three bells survive the uneven split, two then one.
    const names = [...doc.querySelectorAll('part[id="HBC1"] note > pitch > step')].map(
      (s) => s.textContent,
    );
    expect(names).toEqual(["C", "E", "G"]);
  });

  it("adds a transpose only under octaveVia clef+transpose", () => {
    const { doc } = emitted([bell("C", 0, 5)]);
    expect(doc.querySelector('part[id="HBC1"] transpose')).toBeNull();

    const withTranspose = emitted([bell("C", 0, 5)], { ...DORICO, octaveVia: "clef+transpose" });
    expect(
      withTranspose.doc.querySelector('part[id="HBC1"] transpose > octave-change')?.textContent,
    ).toBe("1");
  });

  it("leaves the system break alone when the profile says not to add one", () => {
    const { doc, chart } = emitted([bell("C", 0, 5)], { ...DORICO, systemBreakAfterChart: false });
    expect(doc.querySelector("print")).toBeNull();
    expect(chart.printParts).toEqual([]);
  });

  it("runs a target's postProcess escape hatch", () => {
    // Neither shipped profile defines one, so without this the optional call
    // is never taken and the seam that makes adding a new target possible has
    // no cover at all. Recording the argument state also pins WHEN it runs:
    // after the chart part is in the document, not before.
    const calls: { parts: number; sections: number }[] = [];
    emitted([bell("C", 0, 5)], {
      ...DORICO,
      postProcess: (target, plan) => {
        calls.push({
          parts: target.querySelectorAll("score-partwise > part").length,
          sections: plan.sections.length,
        });
      },
    });
    expect(calls).toEqual([{ parts: 2, sections: 1 }]);
  });

  it("emits a schema-valid chart for the generic target", async () => {
    // GENERIC is a target the user can pick, and it is the only profile with
    // chartStaffSizePercent null — the arm that omits <staff-details> entirely.
    // Every other test here runs DORICO, so without this nothing ever emits
    // the generic target at all, let alone validates it.
    const { doc, xml } = emitted([bell("C", 0, 5), bell("D", 0, 6, "diamond")], GENERIC);
    expect(await validateMusicXml(xml)).toEqual([]);
    expect(doc.querySelector('part[id="HBC1"] staff-size')).toBeNull();
  });

  it("omits the hidden chart staves when the profile says not to hide them", async () => {
    // The Dorico verification gate may flip this flag if Dorico ignores
    // <staff-details print-object="no">, so the false path has to work before
    // anyone reaches for it.
    const { doc, xml } = emitted([bell("C", 0, 5)], {
      ...DORICO,
      hideChartStavesAfterChart: false,
    });
    expect(await validateMusicXml(xml)).toEqual([]);
    const music = doc.querySelectorAll('part[id="HBC1"] > measure')[1];
    expect(music?.querySelector("staff-details")).toBeNull();
  });

  it("picks a fresh id when the score already uses the chart's", async () => {
    // MusicXML types part ids as xs:ID, which must be unique across the
    // document, so a collision produces a score no application can open. A
    // score can legitimately already contain an HBC1 — a previous chart whose
    // part-name was edited, so removeChart no longer recognises it.
    const parsed = parseScore(
      SOURCE.replace(
        '<score-part id="P1">',
        '<score-part id="HBC1"><part-name>Bells</part-name></score-part><score-part id="P1">',
      ).replace('<part id="P1">', '<part id="HBC1"><measure number="1"/></part><part id="P1">'),
    );
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);

    expect(chart.partIds).not.toContain("HBC1");
    const ids = [...parsed.doc.querySelectorAll("part-list > score-part")].map((p) =>
      p.getAttribute("id"),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);
  });
});
