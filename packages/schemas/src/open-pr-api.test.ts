import { describe, expect, it } from 'vitest';
import {
  OpenPrApiRequestSchema,
  OpenPrApiResponseSchema,
} from './open-pr-api.js';

describe('OpenPrApiRequestSchema', () => {
  it('accepts a valid request', () => {
    const request = {
      owner: 'acme',
      repo: 'widgets',
      baseBranch: 'main',
      title: 'Add translations',
      body: 'Automated',
      files: [{ path: 'locales/de.json', content: '{}' }],
    };
    expect(OpenPrApiRequestSchema.parse(request)).toEqual(request);
  });

  it('requires at least one file', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [],
      }),
    ).toThrow();
  });

  it('rejects a file path containing a ".." segment', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: '../../.github/workflows/x.yml', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects an absolute file path', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: '/etc/passwd', content: '{}' }],
      }),
    ).toThrow();
  });

  it('accepts a normal relative locale-file path', () => {
    const request = {
      owner: 'a',
      repo: 'b',
      baseBranch: 'main',
      title: 't',
      body: 'b',
      files: [{ path: 'locales/de.json', content: '{}' }],
    };
    expect(OpenPrApiRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects a file path using backslashes to smuggle a traversal segment', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales\\..\\..\\secret.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a file path containing a bare "." segment', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales/./de.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a file path containing a null byte', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales/de.json\0.png', content: '{}' }],
      }),
    ).toThrow();
  });

  it('accepts a locale code containing a hyphen', () => {
    const request = {
      owner: 'a',
      repo: 'b',
      baseBranch: 'main',
      title: 't',
      body: 'b',
      files: [{ path: 'locales/pt-BR.json', content: '{}' }],
    };
    expect(OpenPrApiRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects a path that does not traverse but is outside the locale directory (allowlist, not just a traversal denylist)', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: '.github/workflows/evil.yml', content: 'evil: true' }],
      }),
    ).toThrow();
  });

  it('rejects a file path containing a space or other non-allowlisted character', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales/de file.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a path at the repo root outside locales/ (package.json)', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'package.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a dotfile-directory path outside locales/ (.github/dependabot.json)', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: '.github/dependabot.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a nested path outside locales/ (apps/api/tsconfig.json)', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'apps/api/tsconfig.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects an owner containing a slash', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a/b',
        repo: 'b',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales/de.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('rejects a repo containing a space', () => {
    expect(() =>
      OpenPrApiRequestSchema.parse({
        owner: 'a',
        repo: 'my repo',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        files: [{ path: 'locales/de.json', content: '{}' }],
      }),
    ).toThrow();
  });

  it('accepts a normal owner, repo, and baseBranch', () => {
    const request = {
      owner: 'acme-corp',
      repo: 'widgets.js',
      baseBranch: 'release/1.0',
      title: 't',
      body: 'b',
      files: [{ path: 'locales/de.json', content: '{}' }],
    };
    expect(OpenPrApiRequestSchema.parse(request)).toEqual(request);
  });
});

describe('OpenPrApiResponseSchema', () => {
  it('accepts a valid response', () => {
    const response = { prUrl: 'https://github.com/a/b/pull/1', prNumber: 1 };
    expect(OpenPrApiResponseSchema.parse(response)).toEqual(response);
  });
});
