import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Downloads } from "./Downloads.js";

import type { ChartDownload } from "./useChartSession.js";

const stubObjectUrl = () => {
  const createObjectURL = vi.fn(() => "blob:stub");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
};

const download = (filename: string, label: string, blob = new Blob([filename])): ChartDownload => ({
  filename,
  blob,
  label,
  hint: `what ${filename} is for`,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Downloads", () => {
  it("hands the built blob and filename to a clicked download link", async () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrl();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const blob = new Blob(["<score-partwise/>"]);
    const user = userEvent.setup();

    render(
      <Downloads buildDownloads={() => [download("out.musicxml", "Download the chart", blob)]} />,
    );
    await user.click(screen.getByRole("button", { name: "Download the chart" }));

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    // The anchor is created and clicked inside the handler, so the only way to
    // see what it carried is from the element `click` was invoked on.
    const [anchor] = click.mock.instances;
    if (!(anchor instanceof HTMLAnchorElement)) {
      throw new Error("the handler never clicked a link");
    }
    expect(anchor.download).toBe("out.musicxml");
    expect(anchor.href).toBe("blob:stub");
    // Revoking matters: an un-revoked object URL pins the whole score in memory
    // for the life of the document.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:stub");
  });

  it("offers a button per file, each saving its own", async () => {
    stubObjectUrl();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(
      <Downloads
        buildDownloads={() => [
          download("score-chart.musicxml", "Download the chart"),
          download("dorico-chart-setup.lua", "Download the setup script"),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download the setup script" }));

    // The second button must save the second file. Indexing the wrong entry
    // would still download something, and still pass a test that only counted
    // buttons or only checked that a save happened.
    const [anchor] = click.mock.instances;
    if (!(anchor instanceof HTMLAnchorElement)) {
      throw new Error("the handler never clicked a link");
    }
    expect(anchor.download).toBe("dorico-chart-setup.lua");
  });

  it("says what each file is for", () => {
    render(
      <Downloads
        buildDownloads={() => [
          download("score-chart.musicxml", "Download the chart"),
          download("dorico-chart-setup.lua", "Download the setup script"),
        ]}
      />,
    );
    expect(screen.getByText("what score-chart.musicxml is for")).toBeInTheDocument();
    expect(screen.getByText("what dorico-chart-setup.lua is for")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to download", () => {
    render(<Downloads buildDownloads={() => []} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("returns quietly when the file disappears between render and click", async () => {
    const { createObjectURL } = stubObjectUrl();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const onError = vi.fn();
    window.addEventListener("error", onError);
    const user = userEvent.setup();

    // Offered on render, gone by the click: the plan changed underneath. A
    // handler that indexed the empty list without checking would throw.
    let first = true;
    render(
      <Downloads
        buildDownloads={() => {
          if (first) {
            first = false;
            return [download("out.musicxml", "Download the chart")];
          }
          return [];
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Download the chart" }));
    window.removeEventListener("error", onError);

    expect(onError).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
