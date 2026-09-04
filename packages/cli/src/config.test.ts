import { describe, expect, it } from 'vitest';
import { fromFlagOrEnv } from './config.js';

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
   * through, `init` then reads `options.apiUrl ?? DEFAULT_API_URL` and keeps
   * the empty string because it is not nullish, and every request goes to
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
