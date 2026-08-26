import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { ScoreParseError } from "./document.js";

export interface LoadedFile {
  readonly xml: string;
  readonly kind: "plain" | "mxl";
  /** Where the score sits inside the container, or the filename when plain. */
  readonly rootPath: string;
}

const MIMETYPE = "application/vnd.recordare.musicxml";
const CONTAINER_PATH = "META-INF/container.xml";
const SUFFIX = "-with-chart";

/** Local file header signature: "PK\x03\x04". */
function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function rootPathFrom(containerXml: string): string {
  const doc = new DOMParser().parseFromString(containerXml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ScoreParseError(`${CONTAINER_PATH} inside this file is not valid XML.`);
  }
  // The MusicXML root must be described in the first rootfile element.
  const path = doc.getElementsByTagName("rootfile")[0]?.getAttribute("full-path");
  if (path === null || path === undefined || path === "") {
    throw new ScoreParseError(`${CONTAINER_PATH} names no rootfile, so the score cannot be found.`);
  }
  return path;
}

export function loadFile(bytes: Uint8Array, filename: string): LoadedFile {
  if (!isZip(bytes)) {
    return { xml: strFromU8(bytes), kind: "plain", rootPath: filename };
  }

  const entries = unzipSync(bytes);
  const container = entries[CONTAINER_PATH];
  if (container === undefined) {
    throw new ScoreParseError(
      `This looks like a compressed MusicXML file but has no ${CONTAINER_PATH}.`,
    );
  }

  const rootPath = rootPathFrom(strFromU8(container));
  const score = entries[rootPath];
  if (score === undefined) {
    throw new ScoreParseError(
      `${CONTAINER_PATH} points at "${rootPath}", which is not in this file.`,
    );
  }

  return { xml: strFromU8(score), kind: "mxl", rootPath };
}

export function saveFile(xml: string, source: LoadedFile): Uint8Array {
  if (source.kind === "plain") {
    return strToU8(xml);
  }
  // The mimetype entry must come first and must not be compressed.
  return zipSync({
    mimetype: [strToU8(MIMETYPE), { level: 0 }],
    [CONTAINER_PATH]: strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<container><rootfiles>` +
        `<rootfile full-path="${source.rootPath}" media-type="${MIMETYPE}+xml"/>` +
        `</rootfiles></container>\n`,
    ),
    [source.rootPath]: strToU8(xml),
  });
}

export function outputFilename(inputName: string): string {
  const dot = inputName.lastIndexOf(".");
  if (dot <= 0) {
    return `${inputName}${SUFFIX}`;
  }
  return `${inputName.slice(0, dot)}${SUFFIX}${inputName.slice(dot)}`;
}
