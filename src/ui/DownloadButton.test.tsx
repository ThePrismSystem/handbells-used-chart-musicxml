import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadButton } from "./DownloadButton.js";

const stubObjectUrl = () => {
  const createObjectURL = vi.fn(() => "blob:stub");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DownloadButton", () => {
  it("hands the built blob and filename to a clicked download link", async () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrl();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const blob = new Blob(["<score-partwise/>"]);
    const user = userEvent.setup();

    render(<DownloadButton buildDownload={() => ({ filename: "out.musicxml", blob })} />);
    await user.click(screen.getByRole("button", { name: /download/i }));

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

  it("returns quietly when there is nothing to download", async () => {
    const { createObjectURL } = stubObjectUrl();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const onError = vi.fn();
    window.addEventListener("error", onError);
    const user = userEvent.setup();

    render(<DownloadButton buildDownload={() => null} />);
    await user.click(screen.getByRole("button", { name: /download/i }));
    window.removeEventListener("error", onError);

    // Asserting only that nothing was allocated or clicked is not enough: a
    // handler that dereferenced the null result would throw before reaching
    // either call and satisfy both. Quietly means it also did not throw.
    expect(onError).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
