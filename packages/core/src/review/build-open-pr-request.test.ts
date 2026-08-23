import { OpenPrApiRequestSchema } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { buildOpenPrRequest } from './build-open-pr-request.js';

const target = {
  owner: 'acme',
  repo: 'widgets',
  baseBranch: 'main',
  installationId: 789,
};

const description = { title: 'Add translations (fr)', body: 'Automated' };
const files = [{ path: 'locales/fr.json', content: '{"a":"b"}' }];

describe('buildOpenPrRequest', () => {
  /*
   * Validated against the schema the API actually parses with, not against a
   * hand-written expectation of it.
   *
   * The approval path once sent a body missing `title` and `body` and got a
   * 400, and no test caught it because nothing checked a built body against
   * the contract it had to satisfy. A test asserting only the keys this
   * function happens to set would repeat that mistake with more steps.
   */
  it('produces a body the API request schema accepts', () => {
    const built = buildOpenPrRequest(target, description, files);
    expect(() => OpenPrApiRequestSchema.parse(built)).not.toThrow();
  });

  it('carries the installation through, so the write uses the same one as the read', () => {
    const built = buildOpenPrRequest(target, description, files);
    expect(built.installationId).toBe(789);
  });

  /*
   * The regression guard for blocker 2b, stated as a property of every result
   * rather than of this one call.
   *
   * `installationId` is optional on the wire — the service falls back to its
   * own configured installation when it is absent — so a build that dropped it
   * would still parse, still open a pull request, and still pass the test
   * above. Only an explicit presence check fails.
   */
  it('never omits the installation, which the schema alone would not catch', () => {
    const built = buildOpenPrRequest(target, description, files);
    expect(Object.keys(built)).toContain('installationId');
    expect(built.installationId).toBeTypeOf('number');

    // Proof that the schema is not the thing protecting this field: the same
    // body without it parses cleanly.
    const { installationId, ...withoutInstallation } = built;
    expect(installationId).toBeDefined();
    expect(() =>
      OpenPrApiRequestSchema.parse(withoutInstallation),
    ).not.toThrow();
  });

  it('passes the description through unchanged rather than rewording it', () => {
    const built = buildOpenPrRequest(target, description, files);
    expect(built.title).toBe(description.title);
    expect(built.body).toBe(description.body);
  });

  it('keeps the files it was given, in order', () => {
    const two = [
      { path: 'locales/fr.json', content: '{}' },
      { path: 'locales/de.json', content: '{}' },
    ];
    expect(buildOpenPrRequest(target, description, two).files).toEqual(two);
  });
});
