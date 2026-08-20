import { describe, expect, it } from 'vitest';
import { resolveInstallation } from './resolve-installation';

/**
 * Cross-tenant isolation, at the one place it is decided.
 *
 * These are not hypotheticals. The rule this file guards replaced a fallback
 * that handed the deployment's shared installation to any organization without
 * one of its own. It was survivable only while every GitHub surface was gated
 * to an operator allow-list — and removing that gate is exactly what self-serve
 * means, so the fallback and the feature could not both ship.
 */
describe('resolveInstallation, tenant scope', () => {
  it('acts as the workspace’s own installation', () => {
    expect(
      resolveInstallation({ kind: 'tenant', organizationInstallationId: 42 }),
    ).toEqual({ ok: true, installationId: 42, source: 'tenant' });
  });

  /*
   * The regression that matters. A workspace with no installation must get
   * nothing — never the shared one. If this ever returns ok, every customer
   * who has not installed the App is holding a token for the operator's
   * repositories, with permission to open pull requests against them.
   */
  it('refuses rather than falling back to the shared installation', () => {
    expect(
      resolveInstallation({ kind: 'tenant', organizationInstallationId: null }),
    ).toEqual({ ok: false, reason: 'no-installation' });
  });

  it('treats a zero or negative id as absent, not as an installation', () => {
    for (const id of [0, -1]) {
      expect(
        resolveInstallation({ kind: 'tenant', organizationInstallationId: id }),
      ).toEqual({ ok: false, reason: 'no-installation' });
    }
  });

  /*
   * A revoked installation is a row that is gone: `link_github_installation`
   * writes it and `unlink_github_installation` deletes it, so the lookup
   * returns null and this is the path a revocation takes. Pinned separately
   * from "never connected" because they arrive here identically and both must
   * fail closed.
   */
  it('fails closed after an installation is revoked', () => {
    const afterRevocation = {
      kind: 'tenant',
      organizationInstallationId: null,
    } as const;
    expect(resolveInstallation(afterRevocation).ok).toBe(false);
  });
});

describe('resolveInstallation, operator scope', () => {
  /*
   * The internal administration path still works — deliberately, and only when
   * a caller asks for it by name. `isOperator` is checked before this is
   * reached; the scope only records that the choice was made on purpose rather
   * than inherited from a fallback.
   */
  it('acts as the shared installation when one is configured', () => {
    expect(
      resolveInstallation({ kind: 'operator', sharedInstallationId: 7 }),
    ).toEqual({ ok: true, installationId: 7, source: 'shared' });
  });

  it('reports a deployment with no GitHub configured', () => {
    expect(
      resolveInstallation({ kind: 'operator', sharedInstallationId: null }),
    ).toEqual({ ok: false, reason: 'not-configured' });
  });
});

describe('the two scopes cannot be confused', () => {
  /*
   * Same shared installation present, two callers: the tenant still gets
   * nothing. This is the isolation property stated as one assertion — the
   * shared installation being configured must not change what a customer sees.
   */
  it('a configured shared installation is invisible to a tenant', () => {
    const shared = resolveInstallation({
      kind: 'operator',
      sharedInstallationId: 99,
    });
    const tenant = resolveInstallation({
      kind: 'tenant',
      organizationInstallationId: null,
    });

    expect(shared).toEqual({
      ok: true,
      installationId: 99,
      source: 'shared',
    });
    expect(tenant.ok).toBe(false);
  });

  it('one tenant never resolves to another tenant’s installation', () => {
    const a = resolveInstallation({
      kind: 'tenant',
      organizationInstallationId: 111,
    });
    const b = resolveInstallation({
      kind: 'tenant',
      organizationInstallationId: 222,
    });

    expect(a).toEqual({ ok: true, installationId: 111, source: 'tenant' });
    expect(b).toEqual({ ok: true, installationId: 222, source: 'tenant' });
  });
});
