export class ScoreParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreParseError";
  }
}

export interface ParsedScore {
  readonly doc: Document;
  readonly declaration: string | null;
  readonly doctype: string | null;
}

const DECLARATION = /^\s*<\?xml[^?]*\?>/;

/** Allows an internal subset, whose brackets may legally contain `>`. */
const DOCTYPE = /<!DOCTYPE\s+[^[>]*(?:\[[\s\S]*?\])?\s*>/;

const ROOT = "score-partwise";

export function parseScore(text: string): ParsedScore {
  const declaration = DECLARATION.exec(text)?.[0].trim() ?? null;
  const doctype = DOCTYPE.exec(text)?.[0] ?? null;

  const doc = new DOMParser().parseFromString(text, "application/xml");

  // DOMParser does not throw on malformed XML; it returns a document
  // containing a <parsererror> element.
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ScoreParseError("This file is not valid XML, so it could not be read.");
  }

  const root = doc.documentElement.nodeName;
  if (root === "score-timewise") {
    throw new ScoreParseError(
      "This is a score-timewise file. Only score-partwise MusicXML is supported; " +
        "re-export it as partwise and try again.",
    );
  }
  if (root !== ROOT) {
    throw new ScoreParseError(
      `This file's root element is <${root}>, not <${ROOT}>, so it is not a MusicXML score.`,
    );
  }

  return { doc, declaration, doctype };
}

export function cloneScore(parsed: ParsedScore): Document {
  return parsed.doc.cloneNode(true) as Document;
}

export function serializeScore(parsed: ParsedScore, doc: Document = parsed.doc): string {
  const body = new XMLSerializer().serializeToString(doc);
  const parts: string[] = [];
  if (parsed.declaration !== null) {
    parts.push(parsed.declaration);
  }
  // Some serialisers emit the doctype from the document node and some do not;
  // prepending unconditionally would duplicate it.
  if (parsed.doctype !== null && !/^\s*<!DOCTYPE/i.test(body)) {
    parts.push(parsed.doctype);
  }
  parts.push(body);
  return `${parts.join("\n")}\n`;
}
