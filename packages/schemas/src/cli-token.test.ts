import { describe, expect, it } from 'vitest';
import {
  CLI_TOKEN_PATTERN,
  PreflightRequestSchema,
  WhoAmIResponseSchema,
  cliTokenPrefix,
  isCliToken,
} from './cli-token.js';

const TOKEN = `lit_${'A'.repeat(43)}`;

describe('CLI token format', () => {
  it('accepts lit_ followed by 43 base64url characters', () => {
    expect(isCliToken(TOKEN)).toBe(true);
    expect(isCliToken(`lit_${'a-_9'.repeat(10)}xyz`)).toBe(true);
  });

  it('rejects anything else, including the operator token shape', () => {
    expect(isCliToken(`lit_${'A'.repeat(42)}`)).toBe(false);
    expect(isCliToken(`lit_${'A'.repeat(44)}`)).toBe(false);
    expect(isCliToken(`LIT_${'A'.repeat(43)}`)).toBe(false);
    expect(isCliToken(`lit_${'A'.repeat(42)}=`)).toBe(false);
    expect(isCliToken('0123456789abcdef'.repeat(4))).toBe(false);
    expect(isCliToken('')).toBe(false);
  });

  it('shows the scheme and six characters, never more', () => {
    expect(cliTokenPrefix(TOKEN)).toBe('lit_AAAAAA');
    expect(cliTokenPrefix(TOKEN)).toMatch(/^lit_[A-Za-z0-9_-]{6}$/);
  });

  // The database check constraint and this pattern must describe one format.
  it('matches the prefix the database accepts', () => {
    expect(CLI_TOKEN_PATTERN.source).toContain('{43}');
  });
});

describe('API shapes', () => {
  it('describes both kinds of caller', () => {
    expect(WhoAmIResponseSchema.parse({ kind: 'operator' })).toEqual({
      kind: 'operator',
    });
    expect(
      WhoAmIResponseSchema.parse({
        kind: 'workspace',
        workspace: 'acme',
        githubConnected: false,
      }),
    ).toMatchObject({ workspace: 'acme' });
  });

  it('requires owner, repo and base branch for a preflight', () => {
    expect(
      PreflightRequestSchema.safeParse({ owner: 'o', repo: 'r' }).success,
    ).toBe(false);
  });
});
