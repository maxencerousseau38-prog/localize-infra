import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the parts of the app that are pure decisions.
 *
 * This app had only Playwright, which meant the logic deciding whether one
 * customer may act as another — installation resolution, tenancy — was
 * reachable only through a browser, a session and a live GitHub App, and
 * therefore untested. `include` is deliberately narrow: everything under
 * `src/lib`, so a component test never quietly starts needing a DOM here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
    /*
     * Three times the default, and the reason is not that anything here is
     * slow.
     *
     * Several of these files call `vi.resetModules()` before each test and then
     * `await import(...)` inside the test body — deliberately, because the
     * modules under test read `process.env` at module scope and a cached copy
     * would carry the previous test's environment. The consequence is that the
     * import's transform cost is billed to the test's own budget, and
     * `discovery-count.test.ts` imports a Next server action whose graph is
     * large.
     *
     * On a machine running `turbo run test` across fifteen packages at once,
     * that transform reliably crossed 5s and two tests failed — the same two,
     * on clean `master`, three runs out of three. They pass in isolation in
     * milliseconds. CI never saw it, so `npm run gates` was red locally and
     * green on the pull request: the exact split this repository has already
     * been burned by, and the reason it is fixed rather than tolerated.
     *
     * This buys headroom for a transform, not for slow logic. A test that
     * genuinely hangs still fails, three seconds later than before.
     */
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported outside a React Server Component.
      // The modules under test are server modules by construction; the guard
      // has nothing to protect here and would only stop them loading.
      'server-only': fileURLToPath(
        new URL('./src/lib/__mocks__/server-only.ts', import.meta.url),
      ),
    },
  },
});
