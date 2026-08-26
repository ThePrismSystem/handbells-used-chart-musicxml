import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import pianoHandbells from "../../test/fixtures/piano-handbells.musicxml?raw";

import { App } from "./App.js";

describe("accessibility", () => {
  it("has no violations in the empty state", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container);
    // Asserting on the rule ids, not the whole results object: a failure then
    // reads `expected [ 'image-alt' ] to deeply equal []` and names what broke.
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("has no violations with the review panel showing", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.upload(
      screen.getByLabelText(/choose a musicxml file/i),
      new File([pianoHandbells], "arrangement.musicxml"),
    );
    await screen.findByRole("heading", { name: /handbells used/i });
    const results = await axe.run(container);
    // Asserting on the rule ids, not the whole results object: a failure then
    // reads `expected [ 'image-alt' ] to deeply equal []` and names what broke.
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("has no violations in the error state", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.upload(
      screen.getByLabelText(/choose a musicxml file/i),
      new File(["nonsense"], "broken.musicxml"),
    );
    await screen.findByRole("alert");
    const results = await axe.run(container);
    // Asserting on the rule ids, not the whole results object: a failure then
    // reads `expected [ 'image-alt' ] to deeply equal []` and names what broke.
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
