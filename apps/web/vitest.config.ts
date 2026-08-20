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
