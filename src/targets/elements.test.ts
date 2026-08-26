import { describe, expect, it } from "vitest";

import { el } from "./elements.js";

const doc = (): Document => new DOMParser().parseFromString("<root/>", "application/xml");

describe("el", () => {
  it("creates a bare element", () => {
    expect(el(doc(), "pitch").outerHTML).toBe("<pitch/>");
  });

  it("sets text content", () => {
    expect(el(doc(), "step", "C").textContent).toBe("C");
  });

  it("sets attributes", () => {
    const element = el(doc(), "measure", undefined, { number: "0", implicit: "yes" });
    expect(element.getAttribute("number")).toBe("0");
    expect(element.getAttribute("implicit")).toBe("yes");
  });

  it("skips an attribute whose value is null", () => {
    const element = el(doc(), "notehead", "diamond", { color: null });
    expect(element.hasAttribute("color")).toBe(false);
  });
});
