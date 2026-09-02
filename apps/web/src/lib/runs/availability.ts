export interface RunAvailabilityInput {
  /** Whether this deployment has GitHub App credentials at all. */
  gitHubConfigured: boolean;
  /** The workspace's own installation, or null if it has none. */
  installationId: number | null;
  /** Whether the project points at a repository. */
  connected: boolean;
  /** The languages the project translates into. */
  targetLocales: readonly string[];
}

export interface RunAvailability {
  canRun: boolean;
  /** Why not, in words for the person reading the page. Null when it can run. */
  reason: string | null;
}

/**
 * Whether a run can be offered, and what to say when it cannot.
 *
 * **One value, because two were allowed to disagree.** `page.tsx` computed
 * `canRun` and the reason as independent expressions, and nothing tied them
 * together. The reason ladder had three rungs — no App, no installation, no
 * repository — and neither expression looked at the target languages. So a
 * project connected to a repository with no language configured rendered the
 * button, with nothing to explain, while `startRun` refused it before writing a
 * run row.
 *
 * That gap cost a day. Clicks landed on such a project, produced no row and no
 * visible outcome, and the missing run was blamed on the deployed code —
 * through two reverts, a reland and five production deploys. See CLAUDE.md.
 *
 * The server keeps its own check, and must: the value can change between the
 * render and the click, and a crafted form post has to be refused whatever the
 * page decided. This function stops the product *offering* what the server will
 * refuse — the principle already stated next to `ScanSection`, that a button
 * which cannot work should not be drawn.
 *
 * The order is the contract. Each rung reports the outermost obstacle, so a
 * deployment with no App does not send someone to the Languages section to fix
 * something that is not theirs.
 */
export function runAvailability({
  gitHubConfigured,
  installationId,
  connected,
  targetLocales,
}: RunAvailabilityInput): RunAvailability {
  const reason = !gitHubConfigured
    ? 'This deployment has no GitHub App configured, so a run has nowhere to open a pull request.'
    : !installationId
      ? 'Install the Localize GitHub App on your account before running.'
      : !connected
        ? 'Connect a repository before running.'
        : targetLocales.length === 0
          ? // Same remedy as `startRun`'s refusal, deliberately: two wordings
            // for one condition drift, and the person has to act in the
            // Languages section either way.
            'Add at least one target language under Languages before running.'
          : null;

  return { canRun: reason === null, reason };
}
