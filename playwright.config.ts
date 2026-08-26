import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./test/a11y",
  fullyParallel: true,
  forbidOnly: process.env["CI"] === "true",
  reporter: process.env["CI"] === "true" ? "github" : "list",
  use: { baseURL: `http://localhost:${String(PORT)}` },
  webServer: {
    command: `pnpm preview --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: process.env["CI"] !== "true",
  },
});
