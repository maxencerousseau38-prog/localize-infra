import 'server-only';

/**
 * GitHub access, and the reason it is gated.
 *
 * This product has **one** GitHub App installation, shared by the whole
 * deployment, configured from the environment. That is enough to prove the
 * pipeline end to end against repositories the operator already owns, and it
 * is emphatically not multi-tenant: the installation's token can reach every
 * repository it was granted, regardless of which customer is asking.
 *
 * So the connection flow is restricted to an allow-list of operator addresses.
 * Without that gate, any signed-up account could point a project at the
 * operator's repositories and open pull requests against them — a
 * cross-tenant privilege escalation wearing a product feature's clothes.
 *
 * The gate comes off when each customer installs the App themselves and the
 * installation id is stored per organization rather than per deployment. Until
 * then every surface that touches GitHub says, in the interface, that it is
 * operator-only.
 */
export interface GitHubConfig {
  appId: number;
  privateKey: string;
  installationId: number;
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

export function readGitHubConfig(): GitHubConfig | null {
  const appId = Number(process.env.GITHUB_APP_ID);
  const installationId = Number(process.env.GITHUB_APP_INSTALLATION_ID);
  const privateKey = readPrivateKey();

  if (!appId || !installationId || !privateKey) return null;
  return { appId, privateKey, installationId };
}

export function isGitHubConfigured(): boolean {
  return readGitHubConfig() !== null;
}

/**
 * Whether this account may use the shared installation.
 *
 * Empty allow-list means nobody, deliberately. A deployment that configures
 * GitHub but forgets the operator list exposes nothing, rather than exposing
 * the installation to everyone — the failure is closed.
 */
export function isOperator(email: string): boolean {
  const raw = process.env.GITHUB_OPERATOR_EMAILS ?? '';
  const allowed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
