import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import pianoHandbells from "../../test/fixtures/piano-handbells.musicxml?raw";

import { useChartSession } from "./useChartSession.js";

const file = (contents: string, name = "arrangement.musicxml"): File =>
  new File([contents], name, { type: "application/vnd.recordare.musicxml+xml" });

const loaded = async (contents = pianoHandbells, name?: string) => {
  const { result } = renderHook(() => useChartSession());
  await act(async () => {
    await result.current.loadFile(file(contents, name));
  });
  return result;
};

describe("useChartSession", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useChartSession());
    expect(result.current.status).toBe("empty");
    expect(result.current.plan).toBeNull();
  });

  it("becomes ready once a file is read", async () => {
    const result = await loaded();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.fileName).toBe("arrangement.musicxml");
    expect(result.current.plan?.sections).toHaveLength(2);
  });

  it("seeds the assignments from the noteheads actually present", async () => {
    const result = await loaded();
    expect(result.current.assignments.get("normal")).toBe("bells");
    expect(result.current.assignments.get("diamond")).toBe("chimes");
  });

  it("defaults an unrecognised notehead to ignore", async () => {
    const withX = pianoHandbells.replace("<notehead>diamond</notehead>", "<notehead>x</notehead>");
    const result = await loaded(withX);
    expect(result.current.assignments.get("x")).toBe("ignore");
  });

  it("re-plans when a notehead is reassigned", async () => {
    const withX = pianoHandbells.replace("<notehead>diamond</notehead>", "<notehead>x</notehead>");
    const result = await loaded(withX);
    expect(result.current.plan?.sections.map((s) => s.kind)).toEqual(["bells"]);

    act(() => {
      result.current.assign("x", "chimes");
    });
    expect(result.current.plan?.sections.map((s) => s.kind)).toEqual(["bells", "chimes"]);
  });

  it("re-plans when a part's convention is overridden", async () => {
    const result = await loaded();
    const names = (): string[] =>
      (result.current.plan?.sections[0]?.treble ?? []).flat().map((entry) => entry.name);
    // Read as sounding, the piano's written C5/G#5/Ab5 are C6/G#6/Ab6 bells.
    expect(names()).toEqual(["C6", "G#6", "Ab6"]);

    act(() => {
      result.current.setConvention("P1", "at-bell-name");
    });
    expect(result.current.conventions.get("P1")).toBe("at-bell-name");
    // Dropping the octave does not merely rename them. C5 sits exactly on the
    // boundary — bassStaff runs C4-C5 and trebleStaff starts at D5 — so the
    // C5 bell moves to the bass half and the treble run loses it entirely.
    // Asserting equal LENGTHS here would be wrong, not merely weak.
    expect(names()).toEqual(["G#5", "Ab5"]);
  });

  it("applies a custom label", async () => {
    const result = await loaded();
    act(() => {
      result.current.update({ bellLabel: "Bells you need" });
    });
    expect(result.current.plan?.sections[0]?.label).toBe("Bells you need");
  });

  it("reports a parse failure rather than throwing", async () => {
    const result = await loaded("<score-partwise><oops></score-partwise>");
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toMatch(/not valid XML/);
    expect(result.current.plan).toBeNull();
  });

  it("reports a timewise score by name", async () => {
    const result = await loaded("<score-timewise><part-list/></score-timewise>");
    await waitFor(() => {
      expect(result.current.error).toMatch(/score-timewise/);
    });
  });

  it("offers the chart and its setup script for Dorico", async () => {
    // Dorico's target writes the chart as its own file to import, so the score
    // is never rewritten and never comes back.
    const result = await loaded();
    const downloads = result.current.buildDownloads();
    expect(downloads.map((d) => d.filename)).toEqual([
      "arrangement-chart.musicxml",
      "dorico-chart-setup.lua",
    ]);
    for (const download of downloads) {
      expect(download.blob.size).toBeGreaterThan(0);
    }
  });

  it("offers the whole score back for a target that inserts", async () => {
    const result = await loaded();
    act(() => {
      result.current.update({ targetId: "generic" });
    });
    const downloads = result.current.buildDownloads();
    expect(downloads.map((d) => d.filename)).toEqual(["arrangement-with-chart.musicxml"]);
    expect(downloads[0]?.blob.size).toBeGreaterThan(0);
  });

  it("offers nothing once every notehead is ignored", async () => {
    // Ready, loaded, and still nothing to hand over: the one path where the
    // session is healthy and the answer is still no. Reached the way a user
    // reaches it, by turning every notehead off in the panel.
    const result = await loaded();
    act(() => {
      for (const head of result.current.assignments.keys()) {
        result.current.assign(head, "ignore");
      }
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.sections).toHaveLength(0);
    expect(result.current.buildDownloads()).toEqual([]);
  });

  it("builds no download before a file is loaded", () => {
    const { result } = renderHook(() => useChartSession());
    expect(result.current.buildDownloads()).toEqual([]);
  });

  it("notices that the score already has a chart", async () => {
    const first = await loaded();
    act(() => {
      first.current.update({ targetId: "generic" });
    });
    const text = await first.current.buildDownloads()[0]?.blob.text();
    const second = await loaded(text ?? "");
    // read is null when a load fails, and `null?.existingChart` is undefined,
    // which satisfies not.toBeNull() — so a score that never loaded would pass
    // a test named for noticing an existing chart. Pin the load first.
    expect(second.current.status).toBe("ready");
    expect(second.current.read).not.toBeNull();
    expect(second.current.read?.existingChart).not.toBeNull();
  });

  it("clears back to empty", async () => {
    const result = await loaded();
    act(() => {
      result.current.reset();
    });
    // reset() clears four things. Asserting only status would stay green if
    // any of the other three lines were deleted, leaving a stale mapping to be
    // applied to whatever file is loaded next.
    expect(result.current.status).toBe("empty");
    expect(result.current.read).toBeNull();
    expect(result.current.plan).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.buildDownloads()).toEqual([]);
  });
});
