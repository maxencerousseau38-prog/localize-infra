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

export interface RunRecord {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
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
}

/** Runs for a project, newest first. Scoped by RLS like everything else. */
export async function listRuns(projectId: string): Promise<RunRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('runs')
    .select(
      'id,status,stage,framework,keys_extracted,keys_translated,locales_succeeded,locales_failed,error,pr_url,pr_number,created_at',
    )
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
