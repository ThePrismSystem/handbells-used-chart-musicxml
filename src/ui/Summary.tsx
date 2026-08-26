import { Fragment } from "react";

import type { ChartPlan, ChartSection } from "../core/plan.js";
import type { ChartEntry } from "../core/types.js";

type Warning = ChartPlan["warnings"][number];

function warningText(warning: Warning): string {
  switch (warning.type) {
    case "ignored-notehead": {
      const noun = warning.count === 1 ? "note" : "notes";
      const verb = warning.count === 1 ? "was" : "were";
      return `${String(warning.count)} ${noun} used a notehead that is not assigned to a chart and ${verb} left off the chart.`;
    }
    case "out-of-range":
      return `Out of the handbell range and left off the chart: ${warning.names.join(", ")}.`;
    case "smb-out-of-range":
      return `Out of the silver melody bell range and left off the chart: ${warning.names.join(", ")}.`;
  }
}

function unreadableText(count: number): string {
  const noun = count === 1 ? "note" : "notes";
  const verb = count === 1 ? "was" : "were";
  return `${String(count)} ${noun} could not be read as a pitch and ${verb} left off the chart.`;
}

/** Ascending sounding pitch, the way a thematic catalogue lists incipits. */
function chartOrder(section: ChartSection): ChartEntry[] {
  return [...section.bass.flat(), ...section.treble.flat()].sort((a, b) => a.midi - b.midi);
}

interface SummaryProps {
  readonly plan: ChartPlan;
  readonly hasExistingChart: boolean;
  readonly unreadable: number;
}

export function Summary({ plan, hasExistingChart, unreadable }: SummaryProps) {
  const messages = [
    ...(unreadable > 0 ? [unreadableText(unreadable)] : []),
    ...plan.warnings.map(warningText),
  ];

  return (
    <section className="panel summary">
      <h2 className="eyebrow">Summary</h2>

      {hasExistingChart && (
        <div className="warning">
          <p>This score already has a chart; downloading will replace it.</p>
        </div>
      )}

      {plan.sections.length === 0 ? (
        <p>There is nothing to chart.</p>
      ) : (
        plan.sections.map((section) => (
          <article key={section.kind} className="section">
            <h3>{section.label}</h3>
            <p className="index mono">
              {chartOrder(section).map((entry, index) => (
                <Fragment key={entry.name}>
                  {index > 0 && <span className="dot"> · </span>}
                  <span
                    className="name"
                    style={section.color === null ? undefined : { color: section.color }}
                  >
                    {entry.name}
                  </span>
                </Fragment>
              ))}
            </p>
          </article>
        ))
      )}

      {messages.length > 0 && (
        <div className="warning">
          <p className="meta">Notes outside the chart:</p>
          <ul>
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
