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

/** SOURCE with a key signature, which SOURCE itself has none of. */
const KEYED = SOURCE.replace(
  "<attributes><divisions>2</divisions>",
  "<attributes><divisions>2</divisions><key><fifths>2</fifths></key>",
);

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

  it("leaves the chart staves unlabelled", () => {
    // print-object on part-name is not enough on its own: Dorico prints the
    // part name as the staff label regardless, and part-name-display is the
    // element that overrides what is drawn. The chart's label is the direction
    // above the staves, so a margin label is a second, redundant one.
    const { doc } = emitted([bell("C", 0, 5)]);
    const display = doc.querySelector("part-list > score-part > part-name-display");
    expect(display?.getAttribute("print-object")).toBe("no");
    expect(display?.children).toHaveLength(0);
  });

  it("names each chart part for its own instrument", () => {
    // Dorico prints part-name as the staff label whatever print-object says.
    // One shared name leaves it labelling the chimes "Handbells Used Chart 2".
    const { doc } = emitted([bell("C", 0, 5), bell("D", 0, 6, "diamond")]);
    const names = [...doc.querySelectorAll("part-list > score-part > part-name")].map(
      (name) => name.textContent,
    );
    expect(names).toEqual(["Handbells Used Chart", "Handchimes Used Chart", "Piano"]);
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

  it("writes bells an octave below their name under writtenOctaveShift -1", () => {
    // MusicXML's own reading: <pitch> is the written pitch, so the bell C5 is
    // written C4 and <clef-octave-change>1</clef-octave-change> names it back.
    const { doc } = emitted([bell("C", 0, 5)], GENERIC);
    expect(doc.querySelector('part[id="HBC1"] note > pitch > octave')?.textContent).toBe("4");
    expect(doc.querySelector('part[id="HBC1"] clef > clef-octave-change')?.textContent).toBe("1");
  });

  it("writes bells at their own pitch for Dorico, which lowers them by the clef", () => {
    // Dorico reads <pitch> as sounding and drops the notehead by the clef's
    // octave change, so the written pitch draws the chart an octave below the
    // score. Handing it the bell's own pitch lands the notehead where the
    // score writes the same note. The clef keeps its 8 either way.
    const { doc } = emitted([bell("C", 0, 5)]);
    expect(doc.querySelector('part[id="HBC1"] note > pitch > octave')?.textContent).toBe("5");
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
    // Not the Dorico profile's behaviour any more, but still a profile flag:
    // an application that honours the hint gets it.
    const { doc } = emitted([bell("C", 0, 5)], { ...DORICO, hideChartStavesAfterChart: true });
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
    // Three columns on two staves: the chime's own one bell and five rests.
    expect(doc.querySelectorAll('part[id="HBC2"] > measure[implicit] note')).toHaveLength(6);
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

  it("adds no system break when the profile says not to", () => {
    const { doc, chart } = emitted([bell("C", 0, 5)], { ...DORICO, systemBreakAfterChart: false });
    expect(doc.querySelector("print")).toBeNull();
    expect(chart.printParts).toEqual([]);
  });

  it("leaves a system break the score already had", () => {
    // The name above can only claim "adds none", because SOURCE carries no
    // <print> to leave alone. This is the other half: an existing break must
    // survive untouched, and must not be counted as one this tool added.
    const parsed = parseScore(
      SOURCE.replace('<measure number="1">', '<measure number="1"><print new-page="yes"/>'),
    );
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);

    const prints = [...parsed.doc.querySelectorAll('part[id="P1"] > measure > print')];
    expect(prints).toHaveLength(1);
    expect(prints[0]?.getAttribute("new-page")).toBe("yes");
    expect(prints[0]?.hasAttribute("new-system")).toBe(false);
    expect(chart.printParts).toEqual([]);
  });

  it("emits a schema-valid chart for the generic target", async () => {
    // GENERIC is a target the user can pick, and every other test here runs
    // DORICO, so without this nothing ever emits the generic target at all,
    // let alone validates it.
    const { xml } = emitted([bell("C", 0, 5), bell("D", 0, 6, "diamond")], GENERIC);
    expect(await validateMusicXml(xml)).toEqual([]);
  });

  it("omits <staff-size> where no profile asks for one", () => {
    // Both shipped profiles leave it null: Dorico ignores <staff-size>, and
    // the generic target leaves sizing to whatever opens the file.
    for (const profile of [DORICO, GENERIC]) {
      const { doc } = emitted([bell("C", 0, 5)], profile);
      expect(doc.querySelector('part[id="HBC1"] staff-size')).toBeNull();
    }
  });

  it("sizes the chart staves when a profile asks for it", async () => {
    // The flag is the scaffolding for a target that does honour <staff-size>,
    // and no shipped profile sets it, so nothing else reaches this arm.
    const { doc, xml } = emitted([bell("C", 0, 4), bell("D", 0, 6)], {
      ...DORICO,
      chartStaffSizePercent: 70,
    });
    expect(await validateMusicXml(xml)).toEqual([]);
    const sizes = [...doc.querySelectorAll('part[id="HBC1"] staff-details > staff-size')].map(
      (size) => size.textContent,
    );
    expect(sizes).toEqual(["70", "70"]);
  });

  it("omits the hidden chart staves for Dorico, which ignores the hint", async () => {
    // The Dorico gate found the staves still drawn and empty after the chart,
    // so the profile no longer emits <staff-details print-object="no"> there.
    const { doc, xml } = emitted([bell("C", 0, 5)]);
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

describe("the chart part's silent tail", () => {
  const metreOf = (measure: Element): string | null => {
    const time = measure.querySelector(":scope > attributes > time");
    return time === null
      ? null
      : `${time.querySelector("beats")?.textContent ?? "?"}/${time.querySelector("beat-type")?.textContent ?? "?"}`;
  };
  const tail = (doc: Document, chartId: string) =>
    [...doc.querySelectorAll(`part[id="${chartId}"] > measure`)].filter(
      (measure) => measure.getAttribute("implicit") !== "yes",
    );

  it("puts the chart part back into the music's metre where the music resumes", () => {
    // The chart part declares its own time signature — one beat per column —
    // so the first tail measure has to restore the music's, or the chart part
    // runs the whole piece in the chart's metre. A one-column chart against
    // 4/4 music is the case that makes this visible: 1/4 versus 4/4.
    const parsed = parseScore(SOURCE);
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    const chartId = chart.partIds[0] ?? "";

    expect(metreOf(tail(parsed.doc, chartId)[0] as Element)).toBe("4/4");
  });

  it("gives each tail measure the music's own measure duration", () => {
    // A measure-rest's duration is what advances the bar. Emitting the chart's
    // duration here leaves the chart part short in every measure of the piece,
    // which schema validation does not check.
    const parsed = parseScore(SOURCE);
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    const chartId = chart.partIds[0] ?? "";

    const durations = tail(parsed.doc, chartId).map(
      (measure) => measure.querySelector(":scope > note > duration")?.textContent,
    );
    // SOURCE is 4/4 with divisions 2, so a full measure is 8 — not the 1 beat
    // the single-column chart measure uses.
    expect(durations).toEqual(["8", "8"]);
  });

  it("re-declares the metre only where the music changes it", () => {
    // Restating <time> in every measure would be noise; omitting it at a real
    // change would be wrong. This score goes 4/4, 4/4, 3/4.
    const parsed = parseScore(
      SOURCE.replace(
        '<measure number="2"><note><rest/><duration>8</duration></note></measure>',
        '<measure number="2"><note><rest/><duration>8</duration></note></measure>' +
          '<measure number="3"><attributes>' +
          "<time><beats>3</beats><beat-type>4</beat-type></time></attributes>" +
          "<note><rest/><duration>6</duration></note></measure>",
      ),
    );
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    const chartId = chart.partIds[0] ?? "";

    expect(tail(parsed.doc, chartId).map(metreOf)).toEqual(["4/4", null, "3/4"]);
  });

  it("matches the music measure for measure through a metre change", async () => {
    const parsed = parseScore(
      SOURCE.replace(
        '<measure number="2"><note><rest/><duration>8</duration></note></measure>',
        '<measure number="2"><attributes>' +
          "<time><beats>6</beats><beat-type>8</beat-type></time></attributes>" +
          "<note><rest/><duration>6</duration></note></measure>",
      ),
    );
    const chart = emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    const chartId = chart.partIds[0] ?? "";

    // 6/8 with divisions 2 is six eighths = three quarters = 6 divisions, not
    // the 12 a beats-times-divisions reading would give.
    const durations = tail(parsed.doc, chartId).map(
      (measure) => measure.querySelector(":scope > note > duration")?.textContent,
    );
    expect(durations).toEqual(["8", "6"]);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);
  });
});

describe("the music part's silent prefix", () => {
  const prefixOf = (doc: Document, partId: string): Element | null =>
    doc.querySelector(`part[id="${partId}"] > measure`);

  it("carries the part's own key and clef", async () => {
    // The prefix now opens the part, so it has to establish what the part's
    // first bar used to. Without a <key> a reader takes the piece as opening
    // atonal and prints a key change at the first real bar — invisible in C
    // major, a spurious signature change in every other key.
    const parsed = parseScore(KEYED);
    emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);

    const attributes = prefixOf(parsed.doc, "P1")?.querySelector(":scope > attributes");
    expect(attributes?.querySelector("key > fifths")?.textContent).toBe("2");
    expect(attributes?.querySelector("clef > sign")?.textContent).toBe("G");
  });

  it("keeps the chart's own metre rather than the music's", () => {
    // Everything else on the prefix is the part's; the time signature is the
    // one thing that must not be, since the prefix is as long as the chart.
    const parsed = parseScore(KEYED);
    emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);

    const time = prefixOf(parsed.doc, "P1")?.querySelector(":scope > attributes > time");
    expect(time?.querySelector("beats")?.textContent).toBe("1");
    expect(time?.getAttribute("print-object")).toBe("no");
  });

  it("puts the metre in schema order on a part that declares none", async () => {
    // <time> is optional. With none to replace, the prefix's own has to be
    // inserted where the schema puts it — after <key>, before <clef> — or the
    // document no longer validates.
    const parsed = parseScore(
      KEYED.replace("<time><beats>4</beats><beat-type>4</beat-type></time>", ""),
    );
    emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);

    const attributes = prefixOf(parsed.doc, "P1")?.querySelector(":scope > attributes");
    expect([...(attributes?.children ?? [])].map((child) => child.nodeName)).toEqual([
      "divisions",
      "key",
      "time",
      "clef",
    ]);
  });

  it("measures the prefix rest in the part's own divisions", async () => {
    // Divisions are per-part in MusicXML. The prefix declares the part's, so
    // its rest has to be counted in them: taking the first part's leaves every
    // other part's prefix the wrong length.
    const parsed = parseScore(
      SOURCE.replace(
        "</part>\n</score-partwise>",
        "</part>\n" +
          '  <part id="P2">\n' +
          '    <measure number="1"><attributes><divisions>8</divisions>' +
          "<time><beats>4</beats><beat-type>4</beat-type></time>" +
          "<clef><sign>F</sign><line>4</line></clef></attributes>" +
          "<note><rest/><duration>32</duration></note></measure>\n" +
          '    <measure number="2"><note><rest/><duration>32</duration></note></measure>\n' +
          "  </part>\n</score-partwise>",
      ).replace(
        '<score-part id="P1"><part-name>Piano</part-name></score-part>',
        '<score-part id="P1"><part-name>Piano</part-name></score-part>' +
          '<score-part id="P2"><part-name>Cello</part-name></score-part>',
      ),
    );
    emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);

    // One column, so one quarter: 2 divisions in P1 and 8 in P2.
    expect(prefixOf(parsed.doc, "P1")?.querySelector("note > duration")?.textContent).toBe("2");
    expect(prefixOf(parsed.doc, "P2")?.querySelector("note > duration")?.textContent).toBe("8");
  });

  it("still declares a metre on a part whose first measure has no attributes", async () => {
    // A part may open with none at all. It still needs the prefix metre, and
    // the rest still has to be counted in the divisions the score declares.
    const parsed = parseScore(
      SOURCE.replace(
        "</part>\n</score-partwise>",
        '</part>\n  <part id="P2"><measure number="1">' +
          "<note><rest/><duration>8</duration></note></measure>" +
          '<measure number="2"><note><rest/><duration>8</duration></note></measure>' +
          "</part>\n</score-partwise>",
      ).replace(
        '<score-part id="P1"><part-name>Piano</part-name></score-part>',
        '<score-part id="P1"><part-name>Piano</part-name></score-part>' +
          '<score-part id="P2"><part-name>Cello</part-name></score-part>',
      ),
    );
    emitChart(parsed.doc, planFor([bell("C", 0, 5)]), DORICO);
    expect(await validateMusicXml(serializeScore(parsed))).toEqual([]);

    const prefix = prefixOf(parsed.doc, "P2");
    expect(prefix?.querySelector("attributes > time > beats")?.textContent).toBe("1");
    expect(prefix?.querySelector("note > duration")?.textContent).toBe("2");
  });
});
