interface DownloadButtonProps {
  readonly buildDownload: () => { filename: string; blob: Blob } | null;
}

/**
 * Builds the blob fresh on every click rather than holding a stale object
 * URL: a plan built from live options must never go stale behind an <a
 * download> whose href was captured on an earlier render.
 */
export default function DownloadButton({ buildDownload }: DownloadButtonProps) {
  const handleClick = () => {
    const result = buildDownload();
    if (result === null) {
      return;
    }
    const url = URL.createObjectURL(result.blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <button type="button" className="primary" onClick={handleClick}>
      Download the chart
    </button>
  );
}
