import type { ChartDownload } from "./useChartSession.js";

interface DownloadsProps {
  readonly buildDownloads: () => readonly ChartDownload[];
}

function save(download: ChartDownload): void {
  const url = URL.createObjectURL(download.blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = download.filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Builds each blob fresh on the click rather than holding a stale object URL:
 * a plan built from live options must never go stale behind an <a download>
 * whose href was captured on an earlier render. That is also why the list is
 * rebuilt on render — the target can change how many files there are.
 */
export function Downloads({ buildDownloads }: DownloadsProps) {
  const downloads = buildDownloads();

  return (
    <div className="downloads">
      {downloads.map((download, index) => (
        <div className="download" key={download.filename}>
          <button
            type="button"
            className={index === 0 ? "primary" : undefined}
            onClick={() => {
              // Rebuild at click time; `downloads` is only what to offer.
              const fresh = buildDownloads()[index];
              if (fresh !== undefined) {
                save(fresh);
              }
            }}
          >
            {download.label}
          </button>
          <p className="hint">{download.hint}</p>
        </div>
      ))}
    </div>
  );
}
