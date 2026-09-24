import { repositoryFrom } from '@/app/runs/[id]/run-status';
import { describe, expect, it } from 'vitest';

/**
 * That the repository shown on a run comes from the pull request it opened.
 *
 * `RUN_SELECT` carries no `project_id` and no join, so a run record genuinely
 * does not know which repository it touched — and the run detail page showed
 * none, on a product whose whole output is a pull request against one. Adding a
 * column and a second query to answer that would be a schema-shaped answer to a
 * layout question.
 *
 * The pull request URL already contains it. This reads it, and the only reason
 * that is safe is that `asGitHubPullRequest` has already parsed the value with
 * `new URL`, checked the scheme is https, checked the host is github.com and
 * matched `/owner/name/pull/123` — before this function is ever called.
 *
 * So these cases are about the *shape*, not about trust: the guarantee comes
 * from the caller, and a test that fed this arbitrary strings would be
 * asserting a contract this function does not have.
 */
describe('repositoryFrom', () => {
  it('reads owner and name out of a vetted pull request URL', () => {
    expect(
      repositoryFrom(
        'https://github.com/maxencerousseau38-prog/localize-infra-fixture-vite/pull/1',
      ),
    ).toBe('maxencerousseau38-prog/localize-infra-fixture-vite');
  });

  it('says nothing when the run opened no pull request', () => {
    /*
     * The honest answer, and the reason this returns null rather than a
     * placeholder: a run that opened nothing has not told the page where it
     * would have gone, and "—" in a repository slot would read as a repository
     * that could not be determined rather than one that does not apply.
     */
    expect(repositoryFrom(null)).toBeNull();
  });

  it('survives a name containing the separators it splits on', () => {
    // Repository names admit dots and dashes; `projects_repository_is_whole`
    // and the schema's regex allow `[A-Za-z0-9._-]`. A split on '/' is only
    // safe because the path has a fixed depth, which is what this pins.
    expect(repositoryFrom('https://github.com/acme/web.app-v2/pull/9814')).toBe(
      'acme/web.app-v2',
    );
  });
});
