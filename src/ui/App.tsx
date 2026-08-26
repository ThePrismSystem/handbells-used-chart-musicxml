import DownloadButton from "./DownloadButton.js";
import DropZone from "./DropZone.js";
import { useChartSession } from "./useChartSession.js";

import type { ChartPlan } from "../core/plan.js";

type Warning = ChartPlan["warnings"][number];

function warningText(warning: Warning): string {
  switch (warning.type) {
    case "ignored-notehead":
      return `${String(warning.count)} note${warning.count === 1 ? "" : "s"} used a notehead that is not assigned to a chart and were left off it.`;
    case "out-of-range":
      return `Out of the handbell range and left off the chart: ${warning.names.join(", ")}.`;
    case "smb-out-of-range":
      return `Out of the silver melody bell range and left off the chart: ${warning.names.join(", ")}.`;
  }
}

export default function App() {
  const { status, fileName, error, read, plan, loadFile, buildDownload, reset } = useChartSession();

  const handleFile = (file: File) => {
    void loadFile(file);
  };

  const partCount = read?.parts.length ?? 0;
  const noteCount = read?.notes.length ?? 0;
  const summary =
    status === "ready"
      ? `${String(partCount)} part${partCount === 1 ? "" : "s"} · ${String(noteCount)} note${noteCount === 1 ? "" : "s"} read`
      : "Choose a MusicXML file to see which bells it uses.";

  return (
    <div className="page">
      <header className="masthead">
        <h1>{fileName ?? "Handbells Used Chart"}</h1>
        <p className="summary" role="status" aria-live="polite">
          {summary}
        </p>
      </header>

      <main>
        {error !== null && (
          <div className="warning alert" role="alert">
            <p className="eyebrow">Error</p>
            <p>{error}</p>
            <button type="button" onClick={reset}>
              Start again
            </button>
          </div>
        )}

        {status === "ready" && plan !== null && read !== null && (
          <section className="review">
            <h2 className="eyebrow">Review</h2>

            {read.existingChart !== null && (
              <div className="warning">
                <p>This score already has a chart; downloading will replace it.</p>
              </div>
            )}

            {plan.sections.map((section) => (
              <article key={section.kind} className="section">
                <h3 style={section.color === null ? undefined : { color: section.color }}>
                  {section.label}
                </h3>
                <p className="mono meta">
                  notehead “{section.notehead}” · {section.columns} column
                  {section.columns === 1 ? "" : "s"}
                </p>
              </article>
            ))}

            {plan.warnings.length > 0 && (
              <div className="warning">
                {plan.warnings.map((warning) => (
                  <p key={warning.type}>{warningText(warning)}</p>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="controls">
        <DropZone onFile={handleFile} />
        {status === "ready" && plan !== null && <DownloadButton buildDownload={buildDownload} />}
      </footer>
    </div>
  );
}
