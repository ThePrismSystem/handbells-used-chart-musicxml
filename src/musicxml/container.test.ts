import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { loadFile, outputFilename, saveFile } from "./container.js";
import { ScoreParseError } from "./document.js";

const SCORE = '<?xml version="1.0"?>\n<score-partwise version="4.0"><part-list/></score-partwise>';
const MIMETYPE = "application/vnd.recordare.musicxml";

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles>
  <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
</rootfiles></container>`;

const makeMxl = (): Uint8Array =>
  zipSync({
    mimetype: [strToU8(MIMETYPE), { level: 0 }],
    "META-INF/container.xml": strToU8(CONTAINER),
    "score.xml": strToU8(SCORE),
  });

describe("loadFile", () => {
  it("reads a plain MusicXML file", () => {
    const loaded = loadFile(strToU8(SCORE), "arrangement.musicxml");
    expect(loaded.kind).toBe("plain");
    expect(loaded.xml).toContain("score-partwise");
    expect(loaded.rootPath).toBe("arrangement.musicxml");
  });

  it("reads a .xml file as plain, since older MusicXML uses that extension", () => {
    expect(loadFile(strToU8(SCORE), "arrangement.xml").kind).toBe("plain");
  });

  it("reads the rootfile out of an .mxl container", () => {
    const loaded = loadFile(makeMxl(), "arrangement.mxl");
    expect(loaded.kind).toBe("mxl");
    expect(loaded.rootPath).toBe("score.xml");
    expect(loaded.xml).toContain("score-partwise");
  });

  it("detects a zip by its signature even when the extension lies", () => {
    expect(loadFile(makeMxl(), "arrangement.musicxml").kind).toBe("mxl");
  });

  it("refuses an .mxl with no container.xml", () => {
    const bytes = zipSync({ "score.xml": strToU8(SCORE) });
    expect(() => loadFile(bytes, "broken.mxl")).toThrow(/META-INF\/container\.xml/);
  });

  it("refuses an .mxl whose rootfile does not resolve", () => {
    const bytes = zipSync({
      mimetype: [strToU8(MIMETYPE), { level: 0 }],
      "META-INF/container.xml": strToU8(CONTAINER),
    });
    // Assert the message, not just the type: loadFile throws ScoreParseError
    // for four distinct faults, so the class alone would not prove this
    // fixture reached the rootfile-resolution branch rather than failing
    // earlier on the container.
    expect(() => loadFile(bytes, "broken.mxl")).toThrow(ScoreParseError);
    expect(() => loadFile(bytes, "broken.mxl")).toThrow(/which is not in this file/);
  });

  it("refuses an .mxl whose container.xml is not valid XML", () => {
    const bytes = zipSync({
      mimetype: [strToU8(MIMETYPE), { level: 0 }],
      "META-INF/container.xml": strToU8("<container><oops></container>"),
    });
    expect(() => loadFile(bytes, "broken.mxl")).toThrow(/is not valid XML/);
  });

  it("refuses an .mxl whose container.xml names no usable rootfile", () => {
    // The guard is `path === null || path === undefined || path === ""`, and
    // these three containers hit those three arms in order: an absent
    // full-path attribute gives null, no rootfile element at all gives
    // undefined, and an empty attribute gives "".
    for (const container of [
      "<container><rootfiles><rootfile/></rootfiles></container>",
      "<container><rootfiles/></container>",
      '<container><rootfiles><rootfile full-path=""/></rootfiles></container>',
    ]) {
      const bytes = zipSync({
        mimetype: [strToU8(MIMETYPE), { level: 0 }],
        "META-INF/container.xml": strToU8(container),
      });
      expect(() => loadFile(bytes, "broken.mxl")).toThrow(/names no rootfile/);
    }
  });
});

describe("saveFile", () => {
  it("returns plain bytes for a plain input", () => {
    const source = loadFile(strToU8(SCORE), "a.musicxml");
    expect(new TextDecoder().decode(saveFile(SCORE, source))).toBe(SCORE);
  });

  it("writes mimetype first, stored uncompressed", () => {
    const bytes = saveFile(SCORE, { kind: "mxl", xml: SCORE, rootPath: "score.xml" });
    const decoder = new TextDecoder();
    // The zip local file header is a fixed 30 bytes, so the filename starts at
    // byte 30 and its content at 38 — but only when no extra field precedes
    // it, which container.dtd requires. Reading at exact offsets pins that
    // the mimetype entry is genuinely first and genuinely stored: a deflated
    // entry would not have its content readable as cleartext here.
    expect(decoder.decode(bytes.slice(30, 38))).toBe("mimetype");
    expect(decoder.decode(bytes.slice(38, 38 + MIMETYPE.length))).toBe(MIMETYPE);
  });

  it("writes the expected zip entries", () => {
    const source = loadFile(makeMxl(), "a.mxl");
    const entries = unzipSync(saveFile(SCORE, source));
    expect(Object.keys(entries)).toContain("META-INF/container.xml");
    expect(new TextDecoder().decode(entries["score.xml"])).toBe(SCORE);
  });

  it("reads back what it wrote", () => {
    const source = loadFile(makeMxl(), "a.mxl");
    const reread = loadFile(saveFile(SCORE, source), "a.mxl");
    expect(reread.kind).toBe("mxl");
    expect(reread.rootPath).toBe(source.rootPath);
    expect(reread.xml).toBe(SCORE);
  });

  it("round-trips a rootfile path containing XML metacharacters", () => {
    // Reading unescapes entities, so writing must re-escape them. Without
    // that, this container comes back out unparseable and the saved file
    // cannot be reopened at all.
    const path = 'Bach & "Sons".xml';
    const bytes = zipSync({
      mimetype: [strToU8(MIMETYPE), { level: 0 }],
      "META-INF/container.xml": strToU8(
        `<container><rootfiles>` +
          `<rootfile full-path="Bach &amp; &quot;Sons&quot;.xml"/>` +
          `</rootfiles></container>`,
      ),
      [path]: strToU8(SCORE),
    });
    const source = loadFile(bytes, "a.mxl");
    expect(source.rootPath).toBe(path);
    const reread = loadFile(saveFile(SCORE, source), "a.mxl");
    expect(reread.xml).toBe(SCORE);
  });

  it("writes the score back to the path the container named", () => {
    const bytes = zipSync({
      mimetype: [strToU8(MIMETYPE), { level: 0 }],
      "META-INF/container.xml": strToU8(CONTAINER.replace("score.xml", "nested/here.xml")),
      "nested/here.xml": strToU8(SCORE),
    });
    const source = loadFile(bytes, "a.mxl");
    const entries = unzipSync(saveFile(SCORE, source));
    expect(Object.keys(entries)).toContain("nested/here.xml");
  });
});

describe("outputFilename", () => {
  it("inserts the suffix before the extension", () => {
    expect(outputFilename("arrangement.mxl")).toBe("arrangement-with-chart.mxl");
    expect(outputFilename("arrangement.musicxml")).toBe("arrangement-with-chart.musicxml");
    expect(outputFilename("a.b.xml")).toBe("a.b-with-chart.xml");
  });

  it("appends when there is no extension", () => {
    expect(outputFilename("arrangement")).toBe("arrangement-with-chart");
  });
});
