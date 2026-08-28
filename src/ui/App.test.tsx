import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import pianoHandbells from "../../test/fixtures/piano-handbells.musicxml?raw";

import { App } from "./App.js";

const upload = async (contents = pianoHandbells, name = "arrangement.musicxml") => {
  const user = userEvent.setup();
  render(<App />);
  const input = screen.getByLabelText(/choose a musicxml file/i);
  await user.upload(input, new File([contents], name));
  return user;
};

describe("App", () => {
  it("offers a keyboard-reachable file input, not drop only", () => {
    render(<App />);
    // Drag and drop is an enhancement; it must never be the only route in.
    const input = screen.getByLabelText(/choose a musicxml file/i);
    expect(input).toBeInTheDocument();
    // Presence of a matching label is not enough: a <div> with that aria-label
    // and a drop handler would satisfy it while leaving keyboard users with no
    // way in at all. Only a real file input is a route in.
    expect(input).toHaveAttribute("type", "file");
  });

  it("names the accepted formats", () => {
    render(<App />);
    expect(screen.getByText(/\.musicxml/i)).toBeInTheDocument();
    expect(screen.getByText(/\.mxl/i)).toBeInTheDocument();
  });

  it("shows the review panel once a file is read", async () => {
    await upload();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /handbells used: 4/i })).toBeInTheDocument();
    });
  });

  it("announces the loaded file by name", async () => {
    await upload();
    expect(await screen.findByText("arrangement.musicxml")).toBeInTheDocument();
  });

  it("offers the chart and its setup script once a file is read", async () => {
    // The default target is Dorico, which hands over two files rather than a
    // rewritten score: the chart to import, and the script that lays it out.
    await upload();
    expect(await screen.findByRole("button", { name: "Download the chart" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download the setup script" })).toBeEnabled();
  });

  it("shows no download before a file is read", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("reports a bad file as an alert rather than a blank screen", async () => {
    await upload("<score-partwise><oops></score-partwise>", "broken.musicxml");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not valid XML/i);
  });

  it("lets the user start again after an error", async () => {
    const user = await upload("nonsense", "broken.musicxml");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /start again|clear/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the parse through a polite live region", async () => {
    await upload();
    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("warns that an existing chart will be replaced", async () => {
    const charted = pianoHandbells
      .replace(
        "<part-list>",
        '<part-list><score-part id="HBC1"><part-name>Handbells Used Chart</part-name></score-part>',
      )
      .replace(
        "</score-partwise>",
        '<part id="HBC1"><measure number="0"/></part></score-partwise>',
      );
    await upload(charted);
    expect(await screen.findByText(/already has a chart/i)).toBeInTheDocument();
  });

  it("says how many notes an unassigned notehead cost, in agreement with the count", async () => {
    // One note, so the sentence has to read "1 note ... was left off" — a
    // message that says "1 note ... were left off" is the reason this asserts
    // the whole sentence rather than just the digit.
    await upload(pianoHandbells.replace("<notehead>diamond</notehead>", "<notehead>x</notehead>"));
    expect(
      await screen.findByText(
        /1 note used a notehead that is not assigned to a chart and was left off the chart\./i,
      ),
    ).toBeInTheDocument();
  });

  it("pluralises the unassigned-notehead warning for more than one note", async () => {
    const twoIgnored = pianoHandbells
      .replace("<notehead>diamond</notehead>", "<notehead>x</notehead>")
      .replace(
        "</measure>",
        "<note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration>" +
          "<voice>1</voice><type>quarter</type><notehead>x</notehead><staff>1</staff></note></measure>",
      );
    await upload(twoIgnored);
    expect(
      await screen.findByText(
        /2 notes used a notehead that is not assigned to a chart and were left off the chart\./i,
      ),
    ).toBeInTheDocument();
  });

  it("names the bells it dropped for being out of the handbell range", async () => {
    // The chart's own rows above the treble staff reach C9, so C9 still has a
    // place to go. D9 is the first bell with none — hence D8 written, which
    // this part's octave-below convention names D9.
    const tooHigh = pianoHandbells.replace(
      "</measure>",
      "<note><pitch><step>D</step><octave>8</octave></pitch><duration>2</duration>" +
        "<voice>1</voice><type>quarter</type><staff>1</staff></note></measure>",
    );
    await upload(tooHigh);
    // Naming the bell is the point of the warning: "some notes were out of
    // range" would leave the arranger hunting for which.
    expect(await screen.findByText(/out of the handbell range.*D9/i)).toBeInTheDocument();
  });

  it("reports out-of-range silver melody bells separately from handbells", async () => {
    const lowSmb = pianoHandbells.replace(
      "</measure>",
      "<note><pitch><step>B</step><octave>3</octave></pitch><duration>2</duration>" +
        "<voice>1</voice><type>quarter</type><notehead>la</notehead><staff>1</staff></note></measure>",
    );
    await upload(lowSmb);
    // The two compasses differ, so a bell can be fine as a handbell and out of
    // range as a silver melody bell. Folding them into one message would tell
    // the arranger to transpose a note that is already where it belongs.
    expect(await screen.findByText(/out of the silver melody bell range.*B4/i)).toBeInTheDocument();
  });
});
