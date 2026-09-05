import { RUN_SELECT } from '@/lib/data/run-columns';
import type {
  Organization,
  OrganizationRole,
  Project,
} from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Reads for the workspace surfaces.
 *
 * Every query here is scoped by RLS rather than by a WHERE clause this file
 * remembers to write. That is deliberate: the isolation guarantee lives in the
 * database (see supabase/migrations), so a query that forgets its organization
 * returns nothing instead of someone else's rows. These functions add no
 * filtering of their own beyond what a human would expect to read.
 */

export interface Session {
  userId: string;
  email: string;
}

/**
 * The signed-in user, or a redirect.
 *
 * The proxy already blocks unauthenticated requests, so reaching here without a
 * session means the proxy was bypassed or misconfigured. Redirecting rather
 * than returning null keeps every caller from having to handle a case that
 * should not exist — and keeps the failure safe rather than silent.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect('/login');
  return { userId: user.id, email: user.email };
}

/** Organizations the caller belongs to, oldest first. */
export async function listOrganizations(): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load workspaces: ${error.message}`);
  return data ?? [];
}

/**
 * One organization by slug, or null.
 *
 * Null covers both "does not exist" and "exists but is not yours", and the
 * caller must not distinguish them: a 404 for a workspace you cannot see and a
 * 403 for one you can are different answers to "does this slug exist", which is
 * an enumeration oracle.
 */
export async function findOrganization(
  slug: string,
): Promise<Organization | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Could not load workspace: ${error.message}`);
  return data ?? null;
}

export async function currentRole(
  organizationId: string,
): Promise<OrganizationRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('org_role', {
    org: organizationId,
  });

  if (error) return null;
  return data ?? null;
}

export interface ProjectDeletionImpact {
  runs: number;
  proposals: number;
  questions: number;
}

/**
 * What deleting this project would take with it.
 *
 * `runs`, `run_translations` and `run_ambiguities` all reference `projects`
 * with `on delete cascade`, so the delete is not scoped to the row somebody
 * sees. Counted rather than described: "this cannot be undone" is true of every
 * delete button ever drawn and tells a person nothing about their own data.
 *
 * `head: true` asks Postgres for the count without the rows — the screen needs
 * three numbers, not seventy-two records it will not render.
 */
export async function projectDeletionImpact(
  projectId: string,
): Promise<ProjectDeletionImpact> {
  const supabase = await createClient();

  const [runs, proposals, questions] = await Promise.all([
    supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('run_translations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('run_ambiguities')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ]);

  return {
    runs: runs.count ?? 0,
    proposals: proposals.count ?? 0,
    questions: questions.count ?? 0,
  };
}

export async function listProjects(organizationId: string): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return data ?? [];
}

export async function findProject(
  organizationId: string,
  slug: string,
): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Could not load project: ${error.message}`);
  return data ?? null;
}

/**
 * Turns a name into a slug, or returns null if nothing usable survives.
 *
 * Must agree with the CHECK constraint in the tenancy_core migration —
 * lowercase alphanumerics separated by single hyphens, 2 to 48 characters.
 * Returning null rather than a mangled fallback means "Ω" is rejected at the
 * form with a readable message instead of at the database with a constraint
 * violation.
 */
export function toSlug(input: string): string | null {
  const slug = input
    .normalize('NFKD')
    // Strip combining marks so "Café" becomes "cafe" rather than "caf".
    //
    // `\p{M}` rather than a character range: a base character plus a combining
    // mark forms one grapheme, and a range that starts inside that pair cannot
    // address it — which is exactly what Biome's noMisleadingCharacterClass
    // catches.
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');

  return slug.length >= 2 ? slug : null;
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  /** Stopped on purpose: the agent found something it will not guess at. */
  | 'awaiting_review'
  /** Finished with nothing to do: every key was already translated. */
  | 'no_changes';

export interface RunRecord {
  id: string;
  status: RunStatus;
  stage: string;
  framework: string | null;
  keys_extracted: number;
  keys_translated: number;
  locales_succeeded: number;
  locales_failed: number;
  error: string | null;
  pr_url: string | null;
  pr_number: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /**
   * When the run last reported progress.
   *
   * Null on runs that predate progress reporting, and on a run that has not
   * moved past `queued`. A stage alone cannot tell a slow run from an abandoned
   * one — a serverless request killed mid-flight leaves no error behind and the
   * row sits at `translate` looking busy forever.
   */
  progress_at: string | null;
  /** The language the strings were written in, when the run recorded one. */
  source_locale: string | null;
  /**
   * Every language the run was asked for.
   *
   * Distinct from the locales that produced proposals, and the difference is
   * the interesting part: a target with no rows is one the run never delivered.
   * `locales_failed` counts them; only this says which.
   */
  target_locales: string[];
}

/** Runs for a project, newest first. Scoped by RLS like everything else. */
export async function listRuns(projectId: string): Promise<RunRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('runs')
    .select(RUN_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(`Could not load runs: ${error.message}`);
  return (data ?? []) as RunRecord[];
}

export interface GitHubInstallation {
  installation_id: number;
  account_login: string;
  account_type: string;
  connected_at: string;
}

/** The workspace's own GitHub installation, if it has connected one. */
export async function findGitHubInstallation(
  organizationId: string,
): Promise<GitHubInstallation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_github_installations')
    .select('installation_id,account_login,account_type,connected_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) return null;
  return (data as GitHubInstallation | null) ?? null;
}

export interface Entitlements {
  plan: 'free' | 'pro';
  private_repositories: boolean;
}

/** What this workspace may do. Read-only to clients; granted server-side. */
export async function findEntitlements(
  organizationId: string,
): Promise<Entitlements> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_entitlements')
    .select('plan,private_repositories')
    .eq('organization_id', organizationId)
    .maybeSingle();

  // Free is the floor, not an error state: every organization gets a row on
  // creation, and a missing one means the same thing as the default.
  return (
    (data as Entitlements | null) ?? {
      plan: 'free',
      private_repositories: false,
    }
  );
}

/**
 * The authorization check, asked of the database rather than computed here.
 *
 * may_use_private_repositories() is the single place the rule lives, so a
 * surface cannot accidentally implement a more generous version of it.
 */
export async function mayUsePrivateRepositories(
  organizationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('may_use_private_repositories', {
    org: organizationId,
  });
  if (error) return false;
  return data === true;
}

export interface AmbiguityAlternative {
  text: string;
  rationale: string;
}

export interface AmbiguityRecord {
  id: string;
  run_id: string;
  translation_key: string;
  locale: string;
  source_text: string;
  proposed_text: string;
  question: string;
  alternatives: AmbiguityAlternative[];
  state: 'unresolved' | 'resolved' | 'dismissed';
  resolved_text: string | null;
  resolved_at: string | null;
  created_at: string;
}

const AMBIGUITY_COLUMNS =
  'id,run_id,translation_key,locale,source_text,proposed_text,question,alternatives,state,resolved_text,resolved_at,created_at';

/**
 * Narrows whatever JSONB came back into the shape the queue renders.
 *
 * `alternatives` is JSONB, so the database guarantees it is an array and
 * nothing about what is in it. A malformed entry drops out rather than
 * reaching a component that would render `undefined` into the page.
 */
function toAlternatives(value: unknown): AmbiguityAlternative[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.text !== 'string' || typeof record.rationale !== 'string')
      return [];
    return [{ text: record.text, rationale: record.rationale }];
  });
}

function toAmbiguity(row: Record<string, unknown>): AmbiguityRecord {
  return {
    ...(row as unknown as AmbiguityRecord),
    alternatives: toAlternatives(row.alternatives),
  };
}

/** Every question raised by a run, newest first. */
export async function listRunAmbiguities(
  runId: string,
): Promise<AmbiguityRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('run_ambiguities')
    .select(AMBIGUITY_COLUMNS)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load ambiguities: ${error.message}`);
  return (data ?? []).map((row) => toAmbiguity(row as Record<string, unknown>));
}

/**
 * Everything still waiting on a person, across every workspace they belong to.
 *
 * RLS already confines `run_ambiguities` to organizations the caller is a
 * member of, so this does not filter by organization at all — adding a client
 * side `in` list would duplicate the policy and be the copy that drifts. The
 * flat /ambiguity route is the reason this exists: it is not scoped to one
 * workspace, and asking "which one?" of a user with a single workspace is a
 * question the product can answer itself.
 */
export async function listOpenAmbiguitiesForViewer(): Promise<
  AmbiguityRecord[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('run_ambiguities')
    .select(AMBIGUITY_COLUMNS)
    .eq('state', 'unresolved')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load ambiguities: ${error.message}`);
  return (data ?? []).map((row) => toAmbiguity(row as Record<string, unknown>));
}

/** Everything still waiting on a person, across a whole workspace. */
export async function listOpenAmbiguities(
  organizationId: string,
): Promise<AmbiguityRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('run_ambiguities')
    .select(AMBIGUITY_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('state', 'unresolved')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load ambiguities: ${error.message}`);
  return (data ?? []).map((row) => toAmbiguity(row as Record<string, unknown>));
}

export interface ProposedTranslation {
  locale: string;
  translation_key: string;
  source_text: string;
  proposed_text: string;
  origin: 'model' | 'preserved' | 'resolved';
}

/**
 * What a run proposes to write, exactly as it will be written.
 *
 * This is what makes the review screen a review rather than an illustration:
 * approving commits these rows verbatim, so what a developer reads here is
 * what lands in the pull request.
 */
export async function listRunTranslations(
  runId: string,
): Promise<ProposedTranslation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('run_translations')
    .select('locale,translation_key,source_text,proposed_text,origin')
    .eq('run_id', runId)
    .order('locale', { ascending: true })
    .order('translation_key', { ascending: true });

  if (error) throw new Error(`Could not load proposals: ${error.message}`);
  return (data ?? []) as ProposedTranslation[];
}

/**
 * Every run this caller can see, newest first.
 *
 * No organization filter, for the same reason as the ambiguity inbox: RLS
 * already confines `runs` to workspaces the caller is a member of, and a
 * client-side `in` list would be a second copy of that policy — the copy that
 * drifts. The flat /runs route is a history across workspaces, not a
 * project-scoped list; `listRuns` remains for the project page.
 */
export async function listRunsForViewer(limit = 50): Promise<RunRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('runs')
    .select(RUN_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load runs: ${error.message}`);
  return (data ?? []) as RunRecord[];
}

/**
 * Coverage per target locale, computed from what runs actually produced.
 *
 * There is no stored coverage table and deliberately no new one: invariant 1
 * says git is the source of truth and Postgres is an index. The honest answer
 * to "how much of this language is done" is how many keys the most recent run
 * proposed for it against how many it extracted, which is what these rows are.
 *
 * A locale a project targets but no run has reached yet is reported at zero
 * rather than omitted — absent from the list reads as "not configured", and
 * that is a different fact.
 */
export interface LocaleCoverage {
  locale: string;
  translated: number;
  total: number;
  needsDecision: number;
  lastRunAt: string | null;
}

export async function listLocaleCoverageForViewer(): Promise<LocaleCoverage[]> {
  const supabase = await createClient();

  // The newest run that produced anything. Coverage from an older run would
  // describe a repository state that has since been replaced.
  const { data: runs, error: runsError } = await supabase
    .from('runs')
    .select('id,created_at,keys_extracted,target_locales')
    .gt('keys_extracted', 0)
    .order('created_at', { ascending: false })
    .limit(1);

  if (runsError) {
    throw new Error(`Could not load coverage: ${runsError.message}`);
  }
  const latest = runs?.[0] as
    | {
        id: string;
        created_at: string;
        keys_extracted: number;
        target_locales: string[] | null;
      }
    | undefined;
  if (!latest) return [];

  const [{ data: rows }, { data: questions }] = await Promise.all([
    supabase.from('run_translations').select('locale').eq('run_id', latest.id),
    supabase
      .from('run_ambiguities')
      .select('locale,state')
      .eq('run_id', latest.id),
  ]);

  const translated = new Map<string, number>();
  for (const row of rows ?? []) {
    const locale = (row as { locale: string }).locale;
    translated.set(locale, (translated.get(locale) ?? 0) + 1);
  }

  const pending = new Map<string, number>();
  for (const row of questions ?? []) {
    const q = row as { locale: string; state: string };
    if (q.state !== 'unresolved') continue;
    pending.set(q.locale, (pending.get(q.locale) ?? 0) + 1);
  }

  const locales = new Set<string>([
    ...(latest.target_locales ?? []),
    ...translated.keys(),
  ]);

  return [...locales].sort().map((locale) => ({
    locale,
    translated: translated.get(locale) ?? 0,
    total: latest.keys_extracted,
    needsDecision: pending.get(locale) ?? 0,
    lastRunAt: latest.created_at,
  }));
}

/**
 * Wording waiting on somebody who knows the product.
 *
 * The /review surface is for a reviewer who is not a developer, so it carries
 * proposals rather than keys and diffs. Only runs that actually stopped for a
 * person are included: a proposal from a run that already opened its pull
 * request is history, and showing it as pending would ask for a decision that
 * has no effect.
 */
export interface ReviewItem extends ProposedTranslation {
  run_id: string;
}

export async function listReviewItemsForViewer(): Promise<ReviewItem[]> {
  const supabase = await createClient();

  const { data: waiting, error: waitingError } = await supabase
    .from('runs')
    .select('id')
    .eq('status', 'awaiting_review')
    .order('created_at', { ascending: false })
    .limit(10);

  if (waitingError) {
    throw new Error(`Could not load reviews: ${waitingError.message}`);
  }
  const ids = (waiting ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('run_translations')
    .select('run_id,locale,translation_key,source_text,proposed_text,origin')
    .in('run_id', ids)
    // Newly translated wording is what a reviewer is being asked about.
    // `preserved` rows are strings already in the repository that the run left
    // alone, and asking somebody to approve text nobody proposed is noise.
    .eq('origin', 'model')
    .order('locale', { ascending: true })
    .order('translation_key', { ascending: true })
    .limit(200);

  if (error) throw new Error(`Could not load reviews: ${error.message}`);
  return (data ?? []) as ReviewItem[];
}

/** A single run, scoped by RLS. Null when it is not this caller's to see. */
export async function findRun(runId: string): Promise<RunRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('runs')
    .select(RUN_SELECT)
    .eq('id', runId)
    .maybeSingle();

  if (error) return null;
  return (data as RunRecord | null) ?? null;
}
