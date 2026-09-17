import { isCliToken } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { generateCliToken, hashCliToken } from './token';

describe('generateCliToken', () => {
  it('issues a token the API will recognise', () => {
    const { token, prefix } = generateCliToken();
    expect(isCliToken(token)).toBe(true);
    expect(prefix).toMatch(/^lit_[A-Za-z0-9_-]{6}$/);
    expect(token.startsWith(prefix)).toBe(true);
  });

  it('never issues the same token twice', () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => generateCliToken().token),
    );
    expect(seen.size).toBe(200);
  });

  it('stores a digest that does not contain the token', () => {
    const { token, hash } = generateCliToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.slice(4));
  });
});

describe('hashCliToken', () => {
  /*
   * The same vector apps/api/src/callers.test.ts pins, checked with sha256sum.
   * The two servers hash independently; if they ever disagreed, every token the
   * web app issued would be refused by the API.
   */
  it('matches the digest the API computes', () => {
    expect(hashCliToken(`lit_${'A'.repeat(43)}`)).toBe(
      '23d2277efa2313281dea86c0ed4138c527fb050434fdd59d18ea82dd60d5bfe4',
    );
  });
});
