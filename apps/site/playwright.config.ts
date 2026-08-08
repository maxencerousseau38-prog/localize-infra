import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3210', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next start -p 3210',
    url: 'http://127.0.0.1:3210',
    // Never reuse in CI. A stale server left on this port would answer every
    // request and the suite would pass against code that is not the code under
    // test — a failure this repo has already paid for once.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
