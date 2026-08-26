import { describe, expect, it } from "vitest";

import pianoHandbells from "../test/fixtures/piano-handbells.musicxml?raw";
import twoPartBellsAndChimes from "../test/fixtures/two-part-bells-and-chimes.musicxml?raw";

import { DEFAULT_HEAD_MAPPING } from "./core/collect.js";
import { parseScore, serializeScore } from "./musicxml/document.js";
import { readScore } from "./musicxml/read.js";
import { applyChart, defaultConventions, planFor } from "./pipeline.js";
import { validateMusicXml } from "./test-support/validate-musicxml.js";

const options = (read: ReturnType<typeof readScore>) => ({
  headMapping: DEFAULT_HEAD_MAPPING,
  targetId: "dorico",
  conventions: defaultConventions(read),
});

describe("the whole pipeline", () => {
  it("charts a piano-written handbell score", async () => {
    const parsed = parseScore(pianoHandbells);
    const read = readScore(parsed.doc);
    const plan = planFor(read, options(read));
    const xml = applyChart(parsed, plan, "dorico");

    expect(await validateMusicXml(xml)).toEqual([]);
    expect(plan.sections.map((s) => s.kind)).toEqual(["bells", "chimes"]);
    // C5, G#5, Ab5 and C3, G2 written on a Piano part are bells an octave up.
    expect(plan.sections[0]?.label).toBe("Handbells Used: 4");
    expect(plan.sections[1]?.label).toBe("Handchimes Used: 1");
  });

  it("does not mutate the parsed document", () => {
    // Emission clones, so a failed run cannot leave a half-edited score.
    // Comparing the whole serialised document catches any edit anywhere;
    // counting parts would miss a note or attribute added to the existing one.
    const parsed = parseScore(pianoHandbells);
    const before = serializeScore(parsed);
    const read = readScore(parsed.doc);
    applyChart(parsed, planFor(read, options(read)), "dorico");
    expect(serializeScore(parsed)).toBe(before);
  });

  it("replaces its own chart rather than adding a second", async () => {
    const first = parseScore(pianoHandbells);
    const firstRead = readScore(first.doc);
    const once = applyChart(first, planFor(firstRead, options(firstRead)), "dorico");

    const second = parseScore(once);
    const secondRead = readScore(second.doc);
    expect(secondRead.existingChart).not.toBeNull();

    const twice = applyChart(second, planFor(secondRead, options(secondRead)), "dorico");
    const final = parseScore(twice);

    expect(await validateMusicXml(twice)).toEqual([]);
    expect(final.doc.querySelectorAll("score-partwise > part")).toHaveLength(3);
    expect(final.doc.querySelectorAll('part[id="P1"] > measure')).toHaveLength(2);
  });

  it("reads the same chart back to the same plan", () => {
    // A re-run skips the chart's own notes, so the second plan matches the first.
    const first = parseScore(pianoHandbells);
    const firstRead = readScore(first.doc);
    const firstPlan = planFor(firstRead, options(firstRead));

    const second = parseScore(applyChart(first, firstPlan, "dorico"));
    const secondRead = readScore(second.doc);
    const secondPlan = planFor(secondRead, options(secondRead));

    // Comparing labels alone would only compare section kinds and distinct
    // pitch counts, so a re-read that duplicated or reshuffled entries without
    // changing those counts would pass a test named for full plan equality.
    expect(secondPlan.sections).toEqual(firstPlan.sections);
    expect(secondPlan.warnings).toEqual(firstPlan.warnings);
  });

  it("re-plans without re-parsing when a convention is overridden", () => {
    const parsed = parseScore(pianoHandbells);
    const read = readScore(parsed.doc);

    const asWritten = planFor(read, {
      ...options(read),
      conventions: new Map([["P1", "at-bell-name" as const]]),
    });
    const asSounding = planFor(read, options(read));
    const treble = (plan: typeof asWritten): string[] =>
      (plan.sections[0]?.treble ?? []).flat().map((entry) => entry.name);

    // The label counts distinct BELLS, and this fixture happens to yield four
    // of them under either convention — so asserting the count cannot tell a
    // real re-plan from an ignored override. The names can: read as written
    // the treble holds G#5 and Ab5, read an octave below it holds C6/G#6/Ab6.
    expect(asWritten.sections[0]?.label).toBe("Handbells Used: 4");
    expect(treble(asWritten)).toEqual(["G#5", "Ab5"]);
    expect(treble(asSounding)).toEqual(["C6", "G#6", "Ab6"]);
  });

  it("preserves the declaration through a full round trip", () => {
    const parsed = parseScore(pianoHandbells);
    const read = readScore(parsed.doc);
    const xml = applyChart(parsed, planFor(read, options(read)), "dorico");
    // "preserves" means the declaration comes back as it went in, encoding
    // included — not merely that some declaration is present.
    expect(xml.startsWith(pianoHandbells.split("\n")[0] ?? "")).toBe(true);
  });

  it("leaves a score with no chartable notes alone", () => {
    const parsed = parseScore(
      '<score-partwise version="4.0"><part-list>' +
        '<score-part id="P1"><part-name>Drums</part-name></score-part></part-list>' +
        '<part id="P1"><measure number="1">' +
        "<attributes><divisions>1</divisions></attributes>" +
        "<note><rest/><duration>4</duration></note></measure></part></score-partwise>",
    );
    const read = readScore(parsed.doc);
    const plan = planFor(read, options(read));
    expect(plan.sections).toEqual([]);

    const xml = applyChart(parsed, plan, "dorico");
    expect(xml).toContain('<part id="P1">');
    // "leaves it alone" has to mean no chart part and no marker. Asserting
    // only that the original part survived would pass even if an empty chart
    // part were inserted beside it, which is exactly the bug this guards.
    const after = parseScore(xml);
    expect(after.doc.querySelectorAll("score-partwise > part")).toHaveLength(1);
    expect(after.doc.querySelector("miscellaneous-field")).toBeNull();
  });
});

describe("defaultConventions", () => {
  it("takes each part's detected convention", () => {
    const read = readScore(parseScore(pianoHandbells).doc);
    expect(defaultConventions(read).get("P1")).toBe("written-octave-below");
  });

  it("gives each part its own convention rather than one shared default", () => {
    // written-octave-below is the detector's fallback for everything, so a
    // fixture whose parts all land on it cannot tell a real per-part lookup
    // from a hardcoded value. P2 carries a handchimes sound with no
    // <transpose>, the one combination that detects as at-bell-name.
    const read = readScore(parseScore(twoPartBellsAndChimes).doc);
    const conventions = defaultConventions(read);
    expect(conventions.size).toBe(read.parts.length);
    expect(conventions.get("P1")).toBe("written-octave-below");
    expect(conventions.get("P2")).toBe("at-bell-name");
  });
});
