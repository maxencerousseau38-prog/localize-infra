import { afterEach, describe, expect, it } from 'vitest';
import { isGitHubConfigured, readGitHubApp } from './config';

/**
 * What "GitHub is configured" has to mean for a multi-tenant deployment.
 *
 * The answer used to include a shared installation id, and that was backwards.
 * `readGitHubConfig` required `GITHUB_APP_INSTALLATION_ID`, and every surface
 * that offers a customer the *self-serve* install — the flow whose entire point
 * is that each workspace brings its own installation — was gated behind it:
 *
 *     const appSlug = readGitHubConfig() ? process.env.GITHUB_APP_SLUG : null;
 *     const canInstall = Boolean(oauth && appSlug && state);
 *
 * So a correctly configured multi-tenant deployment, one that deliberately has
 * no shared installation because sharing one is the thing being replaced, would
 * report GitHub as unconfigured and hide the connect button from every
 * customer. The id it insisted on was read by exactly one function, which had
 * no callers at all.
 */
const VARS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_PRIVATE_KEY_PATH',
  'GITHUB_APP_INSTALLATION_ID',
] as const;

const saved = new Map<string, string | undefined>();
for (const key of VARS) saved.set(key, process.env[key]);

function env(values: Partial<Record<(typeof VARS)[number], string>>) {
  for (const key of VARS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('readGitHubApp', () => {
  it('is configured by an app id and a private key alone', () => {
    env({ GITHUB_APP_ID: '123', GITHUB_APP_PRIVATE_KEY: 'key' });

    // The regression: this returned null without an installation id, which
    // switched self-serve off for the deployments that need it most.
    expect(readGitHubApp()).toEqual({ appId: 123, privateKey: 'key' });
    expect(isGitHubConfigured()).toBe(true);
  });

  it('does not carry a shared installation id at all', () => {
    env({
      GITHUB_APP_ID: '123',
      GITHUB_APP_PRIVATE_KEY: 'key',
      GITHUB_APP_INSTALLATION_ID: '999',
    });

    // Stronger than "does not require it": the deployment-wide installation is
    // not something this type can express, so no caller can reach for it by
    // accident. Acting as an installation is a per-workspace decision made in
    // `resolveInstallation`, and nowhere else.
    expect(readGitHubApp()).not.toHaveProperty('installationId');
  });

  it('is unconfigured without a private key, whatever else is set', () => {
    env({ GITHUB_APP_ID: '123', GITHUB_APP_INSTALLATION_ID: '999' });
    expect(readGitHubApp()).toBeNull();
    expect(isGitHubConfigured()).toBe(false);
  });

  it('is unconfigured without an app id', () => {
    env({ GITHUB_APP_PRIVATE_KEY: 'key' });
    expect(readGitHubApp()).toBeNull();
  });

  it('treats a non-numeric app id as absent rather than as NaN', () => {
    env({ GITHUB_APP_ID: 'not-a-number', GITHUB_APP_PRIVATE_KEY: 'key' });
    expect(readGitHubApp()).toBeNull();
  });
});
