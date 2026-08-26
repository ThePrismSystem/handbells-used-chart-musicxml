import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_HEAD_MAPPING } from "../core/collect.js";
import { toMidi } from "../core/pitch.js";
import { buildPlan } from "../core/plan.js";

import { OptionsPanel } from "./OptionsPanel.js";

import type { ChartSettings } from "./useChartSession.js";
import type { BellRecord, Pitch } from "../core/types.js";

const bell = (step: Pitch["step"], alter: Pitch["alter"], octave: number): BellRecord => {
  const pitch: Pitch = { step, alter, octave };
  return { pitch, midi: toMidi(pitch), notehead: "normal" };
};

const settings: ChartSettings = {
  bellLabel: "",
  chimeLabel: "",
  smbLabel: "",
  chimeColor: "",
  smbColor: "",
  smbsOptional: false,
  targetId: "dorico",
};

describe("OptionsPanel", () => {
  it("shows the generated label as a placeholder before it is overridden", () => {
    const plan = buildPlan([bell("C", 0, 5)], { headMapping: DEFAULT_HEAD_MAPPING });
    render(<OptionsPanel settings={settings} plan={plan} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/handbells label/i)).toHaveAttribute(
      "placeholder",
      "Handbells Used: 1",
    );
  });

  it("falls back to a generic placeholder before any file is read", () => {
    render(<OptionsPanel settings={settings} plan={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/handbells label/i)).toHaveAttribute(
      "placeholder",
      "Handbells Used",
    );
  });

  it("reports a typed handbells label", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/handbells label/i), { target: { value: "Bells" } });
    expect(onChange).toHaveBeenCalledWith({ bellLabel: "Bells" });
  });

  it("reports a typed handchimes label", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/handchimes label/i), { target: { value: "Chimes" } });
    expect(onChange).toHaveBeenCalledWith({ chimeLabel: "Chimes" });
  });

  it("reports a typed SMBs label", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/smbs label/i), { target: { value: "Melody" } });
    expect(onChange).toHaveBeenCalledWith({ smbLabel: "Melody" });
  });

  it("reports a chosen handchimes colour", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/handchimes colour/i), {
      target: { value: "#336699" },
    });
    expect(onChange).toHaveBeenCalledWith({ chimeColor: "#336699" });
  });

  it("reports a chosen SMB colour", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/smb colour/i), { target: { value: "#996633" } });
    expect(onChange).toHaveBeenCalledWith({ smbColor: "#996633" });
  });

  it("always gives the colour swatches a visible border", () => {
    // A colour that matches the panel background must still be findable.
    render(<OptionsPanel settings={settings} plan={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/handchimes colour/i)).toHaveClass("swatch");
    expect(screen.getByLabelText(/smb colour/i)).toHaveClass("swatch");
  });

  it("reports the SMBs-optional checkbox", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /smbs are optional/i }));
    expect(onChange).toHaveBeenCalledWith({ smbsOptional: true });
  });

  it("reports a chosen target application", () => {
    const onChange = vi.fn();
    render(<OptionsPanel settings={settings} plan={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/target application/i), {
      target: { value: "generic" },
    });
    expect(onChange).toHaveBeenCalledWith({ targetId: "generic" });
  });

  it("lists every target application as an option", () => {
    render(<OptionsPanel settings={settings} plan={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Dorico" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Generic MusicXML" })).toBeInTheDocument();
  });

  it("shows an already-chosen chime colour rather than the fallback", () => {
    const withColor: ChartSettings = { ...settings, chimeColor: "#112233" };
    render(<OptionsPanel settings={withColor} plan={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/handchimes colour/i)).toHaveValue("#112233");
  });

  it("shows an already-chosen SMB colour rather than the fallback", () => {
    const withColor: ChartSettings = { ...settings, smbColor: "#445566" };
    render(<OptionsPanel settings={withColor} plan={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/smb colour/i)).toHaveValue("#445566");
  });
});
