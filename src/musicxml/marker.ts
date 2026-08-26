// CHART_PART_NAME is exported by Task 17, its first and only importer; the
// three field names are used only inside this file, so exporting them would
// fail knip with no consumer to justify it.
const CHART_PART_NAME = "Handbells Used Chart";
const MISC_PARTS = "handbellChartParts";
const MISC_MEASURES = "handbellChartMeasures";
const MISC_PRINT_PARTS = "handbellChartPrintParts";

export interface ExistingChart {
  readonly partIds: string[];
  readonly measures: number;
  /** Parts where insertion added a <print new-system="yes"> that removal must undo. */
  readonly printParts: string[];
}

function miscField(doc: Document, name: string): Element | null {
  for (const field of doc.querySelectorAll(
    "identification > miscellaneous > miscellaneous-field",
  )) {
    if (field.getAttribute("name") === name) {
      return field;
    }
  }
  return null;
}

function miscValue(doc: Document, name: string): string | null {
  return miscField(doc, name)?.textContent ?? null;
}

function split(value: string | null): string[] {
  return value === null ? [] : value.split(/\s+/).filter((token) => token !== "");
}

/** Chart parts carry a part-name of their own, which survives a round trip. */
function namedChartPartIds(doc: Document): string[] {
  const ids: string[] = [];
  for (const scorePart of doc.querySelectorAll("part-list > score-part")) {
    const name = scorePart.querySelector("part-name")?.textContent.trim();
    const id = scorePart.getAttribute("id");
    if (name === CHART_PART_NAME && id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

export function findChart(doc: Document): ExistingChart | null {
  const fromFields = split(miscValue(doc, MISC_PARTS));
  if (fromFields.length > 0) {
    const measures = Number(miscValue(doc, MISC_MEASURES) ?? "1");
    return {
      partIds: fromFields,
      measures: Number.isFinite(measures) && measures > 0 ? measures : 1,
      printParts: split(miscValue(doc, MISC_PRINT_PARTS)),
    };
  }

  // The fields may have been dropped by another application's re-export; the
  // part name alone still identifies the chart.
  const named = namedChartPartIds(doc);
  return named.length > 0 ? { partIds: named, measures: 1, printParts: [] } : null;
}

export function writeMarker(doc: Document, chart: ExistingChart): void {
  const root = doc.documentElement;
  let identification = root.querySelector(":scope > identification");
  if (identification === null) {
    identification = doc.createElement("identification");
    // The schema orders work, movement-*, identification, defaults, credit,
    // part-list — so inserting before part-list is always correct.
    root.insertBefore(identification, root.querySelector(":scope > part-list"));
  }

  let miscellaneous = identification.querySelector(":scope > miscellaneous");
  if (miscellaneous === null) {
    miscellaneous = doc.createElement("miscellaneous");
    identification.append(miscellaneous);
  }

  const values: readonly [string, string][] = [
    [MISC_PARTS, chart.partIds.join(" ")],
    [MISC_MEASURES, String(chart.measures)],
    [MISC_PRINT_PARTS, chart.printParts.join(" ")],
  ];

  for (const [name, value] of values) {
    const existing = miscField(doc, name);
    if (existing === null) {
      const field = doc.createElement("miscellaneous-field");
      field.setAttribute("name", name);
      field.textContent = value;
      miscellaneous.append(field);
    } else {
      existing.textContent = value;
    }
  }
}

export function removeChart(doc: Document): boolean {
  const chart = findChart(doc);
  if (chart === null) {
    return false;
  }

  for (const id of chart.partIds) {
    doc.querySelector(`part-list > score-part[id="${id}"]`)?.remove();
    doc.querySelector(`score-partwise > part[id="${id}"]`)?.remove();
  }

  for (const part of doc.querySelectorAll("score-partwise > part")) {
    const measures = [...part.children].filter((child) => child.nodeName === "measure");
    for (const measure of measures.slice(0, chart.measures)) {
      measure.remove();
    }

    const id = part.getAttribute("id");
    if (id !== null && chart.printParts.includes(id)) {
      const first = part.querySelector(":scope > measure");
      const print = first?.querySelector(":scope > print");
      if (print?.getAttribute("new-system") === "yes" && print.children.length === 0) {
        print.remove();
      }
    }
  }

  for (const name of [MISC_PARTS, MISC_MEASURES, MISC_PRINT_PARTS]) {
    miscField(doc, name)?.remove();
  }
  const miscellaneous = doc.querySelector("identification > miscellaneous");
  if (miscellaneous !== null && miscellaneous.children.length === 0) {
    miscellaneous.remove();
  }

  return true;
}
