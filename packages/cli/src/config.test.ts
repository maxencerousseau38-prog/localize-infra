import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, fromFlagOrEnv, resolveApiUrl } from './config.js';

describe('DEFAULT_API_URL', () => {
  /*
   * Pinned exactly. This is where an unconfigured install sends source-derived
   * context, so a change to it should be a deliberate edit to this test, not a
   * side effect.
   */
  it('is the production API, over HTTPS', () => {
    expect(DEFAULT_API_URL).toBe('https://localize-infra-api.vercel.app');
  });

  it('has no trailing slash, since every request appends /v1/…', () => {
    expect(DEFAULT_API_URL.endsWith('/')).toBe(false);
  });

  it('carries no credential of any kind', () => {
    const url = new URL(DEFAULT_API_URL);
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(url.search).toBe('');
  });
});

describe('resolveApiUrl', () => {
  it('uses the production API when nothing overrides it', () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_API_URL);
  });

  it('keeps an override, local or self-hosted', () => {
    expect(resolveApiUrl('http://localhost:8787')).toBe(
      'http://localhost:8787',
    );
    expect(resolveApiUrl('https://api.example.test')).toBe(
      'https://api.example.test',
    );
  });

  /*
   * `…/` produced `//v1/translate`, which the production deployment answers
   * with a 308 instead of the route.
   */
  it('drops trailing slashes so /v1 paths are not doubled', () => {
    expect(resolveApiUrl('https://localize-infra-api.vercel.app/')).toBe(
      DEFAULT_API_URL,
    );
    expect(resolveApiUrl('http://localhost:8787///')).toBe(
      'http://localhost:8787',
    );
  });
});

describe('fromFlagOrEnv', () => {
  it('prefers the flag', () => {
    expect(fromFlagOrEnv('http://flag', 'http://env')).toBe('http://flag');
  });

  it('falls back to the environment', () => {
    expect(fromFlagOrEnv(undefined, 'http://env')).toBe('http://env');
  });

  it('reports absence when neither is given', () => {
    expect(fromFlagOrEnv(undefined, undefined)).toBeUndefined();
  });

  /*
   * The reason this is a function and not `??`.
   *
   * `LOCALIZE_API_URL=` in a shell profile, or a CI secret that resolved to
   * nothing, sets the variable to the empty string. `??` passes that straight
   * through, `resolveApiUrl` then keeps the empty string because it is not
   * nullish, and every request goes to
   * `/v1/translate` with no origin. The failure is a fetch error naming a URL
   * the user never typed.
   *
   * An empty value is absence, not a choice, on both sides.
   */
  it('treats an empty value as absent', () => {
    expect(fromFlagOrEnv('', 'http://env')).toBe('http://env');
    expect(fromFlagOrEnv(undefined, '')).toBeUndefined();
    expect(fromFlagOrEnv('', '')).toBeUndefined();
  });

  it('treats whitespace as absent, and trims what it keeps', () => {
    expect(fromFlagOrEnv('   ', 'http://env')).toBe('http://env');
    expect(fromFlagOrEnv('  http://flag  ', undefined)).toBe('http://flag');
    expect(fromFlagOrEnv(undefined, '\t')).toBeUndefined();
  });
});
