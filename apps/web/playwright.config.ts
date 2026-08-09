import { defineConfig, devices } from '@playwright/test';

/**
 * Observed once, not reproduced: on 2026-08-08 a single `turbo run test:e2e`
 * reported this suite as failed. Turbo surfaced only "Lifecycle script failed",
 * so the failing test was never captured.
 *
 * It has not recurred in seven subsequent runs — three with `.turbo` and both
 * `.next` directories deleted, the rest warm, standalone and through turbo.
 *
 * Deliberately NOT addressed by adding `retries`. A retry would turn this into
 * a green run that hides the very signal worth having, and the suite's value is
 * that it catches things nothing else does. If it recurs, run the suite
 * directly rather than through turbo so the reporter names the test, and
 * capture that name before rerunning — it is the only missing fact.
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3211', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next start -p 3211',
    url: 'http://127.0.0.1:3211',
    // Never reuse in CI. A stale server left on this port would answer every
    // request and the suite would pass against code that is not the code under
    // test — a failure this repo has already paid for once.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
