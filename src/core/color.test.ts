import { describe, expect, it } from "vitest";

import { normalizeColor } from "./color.js";

describe("normalizeColor", () => {
  it("upper-cases the digits", () => {
    // MusicXML's color type matches #[\dA-F]{6}, so lower case is invalid.
    expect(normalizeColor("#c00000")).toBe("#C00000");
  });

  it("expands three-digit shorthand", () => {
    expect(normalizeColor("#abc")).toBe("#AABBCC");
  });

  it("accepts a missing leading hash", () => {
    expect(normalizeColor("c00000")).toBe("#C00000");
  });

  it("trims surrounding space", () => {
    expect(normalizeColor("  #c00000 ")).toBe("#C00000");
  });

  it("returns null for black, which is the default", () => {
    // Black is rendered by writing no colour at all.
    expect(normalizeColor("#000000")).toBeNull();
    expect(normalizeColor("#000")).toBeNull();
  });

  it("returns null for anything unparseable or absent", () => {
    expect(normalizeColor("nonsense")).toBeNull();
    expect(normalizeColor("#12345")).toBeNull();
    expect(normalizeColor("")).toBeNull();
    expect(normalizeColor(null)).toBeNull();
    expect(normalizeColor(undefined)).toBeNull();
  });
});
