import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const apiPort = 4000;
// Both apps must share it; any value works for a local or CI run.
const proxySecret = process.env.WEB_PROXY_SECRET || "e2e-proxy-secret";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Runs against production builds, not the dev servers. CI has already built
  // both apps in an earlier step, so it only starts them. The API comes first;
  // its /health answers 401 without the proxy secret, which counts as ready.
  webServer: [
    {
      command: process.env.CI
        ? "npm run start"
        : "npm run build && npm run start",
      cwd: "../api",
      url: `http://localhost:${apiPort}/health`,
      // Never production: the Origin check accepts http://localhost only
      // outside it, and the session cookie is then `stride_session` (no
      // __Host-, no Secure). DATABASE_URL and PASSWORD_PEPPER come from
      // apps/api/.env locally; CI env is api-foundation's deferred T22.
      env: {
        PORT: String(apiPort),
        WEB_PROXY_SECRET: proxySecret,
        NODE_ENV: "test",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: process.env.CI
        ? `npm run start -- --port ${port}`
        : `npm run build && npm run start -- --port ${port}`,
      url: `http://localhost:${port}`,
      env: {
        API_URL: `http://localhost:${apiPort}`,
        WEB_PROXY_SECRET: proxySecret,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
