import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// `globals: false` in vitest.config.ts means Testing Library's own automatic
// cleanup — which detects a global `afterEach` — never registers, so every
// render() in a suite piles onto the previous one. Register it explicitly.
afterEach(() => {
  cleanup();
});
