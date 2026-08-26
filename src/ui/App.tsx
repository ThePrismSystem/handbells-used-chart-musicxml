import { DownloadButton } from "./DownloadButton.js";
import { DropZone } from "./DropZone.js";
import { NoteheadTable } from "./NoteheadTable.js";
import { OptionsPanel } from "./OptionsPanel.js";
import { PartsPanel } from "./PartsPanel.js";
import { Summary } from "./Summary.js";
import { useChartSession } from "./useChartSession.js";

export function App() {
  const {
    status,
    fileName,
    error,
    read,
    plan,
    assignments,
    conventions,
    settings,
    loadFile,
    assign,
    setConvention,
    update,
    buildDownload,
    reset,
  } = useChartSession();

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
          <>
            <NoteheadTable
              counts={read.noteheadCounts}
              assignments={assignments}
              onAssign={assign}
            />
            <PartsPanel parts={read.parts} conventions={conventions} onChange={setConvention} />
            <OptionsPanel settings={settings} plan={plan} onChange={update} />
            <Summary
              plan={plan}
              hasExistingChart={read.existingChart !== null}
              unreadable={read.unreadable}
            />
          </>
        )}
      </main>

      <footer className="controls">
        <DropZone onFile={handleFile} />
        {status === "ready" && plan !== null && <DownloadButton buildDownload={buildDownload} />}
      </footer>
    </div>
  );
}
