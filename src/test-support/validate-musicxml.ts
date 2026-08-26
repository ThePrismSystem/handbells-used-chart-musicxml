import { validateXML } from "xmllint-wasm";

import musicxmlSchema from "../../vendor/musicxml-schema/musicxml.xsd?raw";
import xlinkSchema from "../../vendor/musicxml-schema/xlink.xsd?raw";
import xmlSchema from "../../vendor/musicxml-schema/xml.xsd?raw";

/** The MusicXML schema is ~380 KB; the default heap is not enough to load it. */
const MEMORY_PAGES = 512;

/** Resolves to the validation errors, or an empty array when the document is valid. */
export async function validateMusicXml(xml: string): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: "score.musicxml", contents: xml }],
    schema: [musicxmlSchema],
    preload: [
      { fileName: "xml.xsd", contents: xmlSchema },
      { fileName: "xlink.xsd", contents: xlinkSchema },
    ],
    initialMemoryPages: MEMORY_PAGES,
    maxMemoryPages: MEMORY_PAGES * 4,
  });
  return result.valid ? [] : result.errors.map((error) => error.message);
}
