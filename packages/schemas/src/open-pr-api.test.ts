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
});

describe('OpenPrApiResponseSchema', () => {
  it('accepts a valid response', () => {
    const response = { prUrl: 'https://github.com/a/b/pull/1', prNumber: 1 };
    expect(OpenPrApiResponseSchema.parse(response)).toEqual(response);
  });
});
