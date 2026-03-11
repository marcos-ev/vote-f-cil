import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:all",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
