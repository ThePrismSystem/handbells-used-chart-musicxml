// CHART_PART_NAME is exported by Task 17, its first and only importer; the
// three field names are used only inside this file, so exporting them would
// fail knip with no consumer to justify it.
export const CHART_PART_NAME = "Handbells Used Chart";
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

/**
 * Emission marks the chart's own measures implicit and strips that attribute
 * from the silent tail, so the leading implicit run in the chart part gives
 * the measure count back even when the marker fields are gone. Counting the
 * CHART part rather than a music part matters: a music part may legitimately
 * open on an implicit pickup measure that must not be removed.
 */
function chartMeasureCount(doc: Document, chartId: string): number {
  const part = doc.querySelector(`score-partwise > part[id="${chartId}"]`);
  let count = 0;
  // A part-list entry with no matching <part> in the body is malformed but
  // real; it yields no measures and falls through to the default below.
  for (const measure of part?.querySelectorAll(":scope > measure") ?? []) {
    if (measure.getAttribute("implicit") !== "yes") {
      break;
    }
    count++;
  }
  // A chart whose measures were renumbered by another application loses the
  // attribute; one measure is what the default profile writes.
  return count > 0 ? count : 1;
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
  const [chartId] = named;
  if (chartId === undefined) {
    return null;
  }
  return { partIds: named, measures: chartMeasureCount(doc, chartId), printParts: [] };
}

export function writeMarker(doc: Document, chart: ExistingChart): void {
  const root = doc.documentElement;
  let identification = root.querySelector(":scope > identification");
  if (identification === null) {
    identification = doc.createElement("identification");
    // score-header order is work, movement-number, movement-title,
    // identification, defaults, credit*, part-list. Anchoring on part-list
    // alone puts identification AFTER defaults and credit on a score that has
    // those but no identification of its own.
    root.insertBefore(
      identification,
      root.querySelector(":scope > defaults, :scope > credit, :scope > part-list"),
    );
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
    const identification = miscellaneous.parentElement;
    miscellaneous.remove();
    // Only an identification this tool created is now empty; one the score
    // brought with it still holds its encoding or creator elements.
    if (identification !== null && identification.children.length === 0) {
      identification.remove();
    }
  }

  return true;
}
