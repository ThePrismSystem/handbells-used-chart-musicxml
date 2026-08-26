import { buildPlan } from "./core/plan.js";
import { resolveBells } from "./core/resolve.js";
import { cloneScore, serializeScore } from "./musicxml/document.js";
import { removeChart, writeMarker } from "./musicxml/marker.js";
import { emitChart } from "./targets/emit.js";
import { targetById } from "./targets/profiles.js";

import type { ChartPlan, PlanOptions } from "./core/plan.js";
import type { OctaveConvention } from "./core/types.js";
import type { ParsedScore } from "./musicxml/document.js";
import type { ReadResult } from "./musicxml/read.js";

export interface ChartOptions extends PlanOptions {
  readonly targetId: string;
  readonly conventions: ReadonlyMap<string, OctaveConvention>;
}

export function defaultConventions(read: ReadResult): Map<string, OctaveConvention> {
  return new Map(read.parts.map((part) => [part.id, part.convention]));
}

/** Pure and cheap: re-runs on every option change without touching the file. */
export function planFor(read: ReadResult, options: ChartOptions): ChartPlan {
  return buildPlan(resolveBells(read.notes, options.conventions), options);
}

/**
 * Always works on a clone, so the parsed document stays pristine: a failed run
 * cannot leave a half-edited score, and repeated downloads cannot accumulate
 * chart parts.
 */
export function applyChart(parsed: ParsedScore, plan: ChartPlan, targetId: string): string {
  const doc = cloneScore(parsed);
  removeChart(doc);
  const chart = emitChart(doc, plan, targetById(targetId));
  if (chart.partIds.length > 0) {
    writeMarker(doc, chart);
  }
  return serializeScore(parsed, doc);
}
