import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
    {/* Both render nothing. A production build loads their script from
        /_vercel on this origin, so the deployed page makes no cross-origin
        request; `pnpm dev` loads Vercel's debug script instead. */}
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);
