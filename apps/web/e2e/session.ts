/**
 * Where the shared sign-in is stored, and who it belongs to.
 *
 * Its own module because Playwright refuses to let one test file import
 * another — auth.setup.ts writes this file and data-surface.spec.ts reads it,
 * and neither may name the other. The constants have to live somewhere both can
 * reach, and duplicating them is how the account and the path drift apart.
 *
 * Gitignored: it holds a real (development) session token.
 */
export const STORAGE_STATE = 'e2e/.auth/acceptance.json';

/** The seeded account, verbatim from supabase/seeds/dev-user.sql. */
export const SEEDED_EMAIL = 'acceptance@localize-infra.dev';
export const SEEDED_PASSWORD = 'acceptance-test-pw-8chars';
