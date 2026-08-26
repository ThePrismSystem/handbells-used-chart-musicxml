import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import pianoHandbells from "../../test/fixtures/piano-handbells.musicxml?raw";

import App from "./App.js";

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

  it("offers a download once a file is read", async () => {
    await upload();
    expect(await screen.findByRole("button", { name: /download/i })).toBeEnabled();
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
});
