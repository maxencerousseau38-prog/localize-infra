import 'server-only';

/**
 * The GitHub App's own credentials — and deliberately nothing else.
 *
 * This used to also carry `installationId`, the deployment's single shared
 * installation, and to return `null` without it. That inverted the thing the
 * product is trying to become. Every surface offering a customer the
 * **self-serve** install was gated on this function:
 *
 *     const appSlug = readGitHubConfig() ? process.env.GITHUB_APP_SLUG : null;
 *
 * so a correctly configured multi-tenant deployment — one with no shared
 * installation, because per-workspace installations are what replaces it —
 * reported GitHub as unconfigured and hid the connect button from everybody.
 * The id it insisted on was read by exactly one function, `operatorInstallationId`,
 * which had no callers at all.
 *
 * What an App needs to exist is an id and a key. *Which installation to act as*
 * is a per-request, per-workspace decision, and it is made in exactly one
 * place — `resolveInstallation` — where it can be tested. Splitting the two is
 * what stops "the deployment has GitHub" from being confused with "this
 * workspace has GitHub".
 */
export interface GitHubApp {
  appId: number;
  privateKey: string;
}

function readPrivateKey(): string | null {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY;
  if (inline) return inline;

  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (!path) return null;

  try {
    // Required lazily: this module is imported by pages that must render on a
    // deployment with no GitHub configured at all.
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function readGitHubApp(): GitHubApp | null {
  const appId = Number(process.env.GITHUB_APP_ID);
  const privateKey = readPrivateKey();

  // `Number(undefined)` and `Number('abc')` are both NaN, and NaN is falsy —
  // so a malformed id is absent rather than reaching Octokit as NaN.
  if (!appId || !privateKey) return null;
  return { appId, privateKey };
}

export function isGitHubConfigured(): boolean {
  return readGitHubApp() !== null;
}

/*
 * `isOperator` was here, and it is gone.
 *
 * It read `GITHUB_OPERATOR_EMAILS` and existed to gate access to the shared
 * installation. Three separate comments in this package stated that callers
 * must check it first — and no caller ever did: it had zero call sites, as did
 * `operatorInstallationId`, the only function that could reach the shared
 * installation.
 *
 * That was not a hole, because the path it guarded was unreachable. It was
 * worse in a quieter way: an allow-list that enforced nothing, described in
 * three places as the thing keeping tenants apart, so anyone reading this
 * package would have believed a control was in force that was not.
 *
 * The isolation is structural instead, and always was: `resolveInstallation`
 * can only express a per-workspace installation, so there is no shared
 * installation for an allow-list to protect. `GITHUB_OPERATOR_EMAILS` and
 * `GITHUB_APP_INSTALLATION_ID` are no longer read by anything and can be
 * removed from the deployment.
 */
