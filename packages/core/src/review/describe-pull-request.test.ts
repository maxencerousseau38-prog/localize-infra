import { OpenPrApiRequestSchema } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { describeApprovedPullRequest } from './describe-pull-request.js';

/**
 * The regression this file exists for.
 *
 * The approval path sent no `title` and no `body` to `/v1/open-pr`, both
 * required, so approving a reviewed run returned 400 and the run was recorded
 * failed. Found by running the flow end to end against a real repository —
 * not by any test, because the two callers built their request bodies
 * separately and only one of them was exercised.
 */
const base = {
  locales: ['fr', 'de'],
  keyCount: 8,
  framework: 'Vite + React',
  decisions: [],
};

describe('describeApprovedPullRequest', () => {
  it('produces a title and body the open-PR schema accepts', () => {
    // The assertion that would have caught the bug: validate against the same
    // schema the API validates with, rather than against a hand-written shape.
    const { title, body } = describeApprovedPullRequest(base);
    const parsed = OpenPrApiRequestSchema.safeParse({
      owner: 'acme',
      repo: 'app',
      baseBranch: 'main',
      title,
      body,
      files: [{ path: 'locales/fr.json', content: '{}' }],
    });
    expect(parsed.success).toBe(true);
  });

  it('never produces an empty title or body', () => {
    for (const decisions of [
      [],
      [{ state: 'resolved', resolvedText: null }],
      [{ state: 'dismissed', resolvedText: null }],
    ]) {
      const d = describeApprovedPullRequest({ ...base, decisions });
      expect(d.title.trim().length).toBeGreaterThan(0);
      expect(d.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('matches the unattended path, so one product does not speak two ways', () => {
    // run-actions.ts titles its pull request the same way. A reviewer should
    // not be able to tell which path opened it from the title alone.
    expect(describeApprovedPullRequest(base).title).toBe(
      'Add translations (fr, de)',
    );
  });

  it('says a person reviewed it, and how many questions they answered', () => {
    const { body } = describeApprovedPullRequest({
      ...base,
      decisions: [
        { state: 'resolved', resolvedText: 'Restant' },
        { state: 'resolved', resolvedText: null },
        { state: 'dismissed', resolvedText: null },
      ],
    });

    expect(body).toContain('A person reviewed this');
    expect(body).toContain('2 questions answered');
    // The override is called out separately: choosing different wording is a
    // stronger signal than accepting the suggestion.
    expect(body).toContain('1 of them by choosing wording other than');
    expect(body).toContain('1 question dismissed');
  });

  it('says plainly when nothing was raised, rather than leaving it blank', () => {
    // A run that asked nothing is a different claim from a run whose questions
    // were skipped, and the reviewer should be able to tell them apart.
    const { body } = describeApprovedPullRequest(base);
    expect(body).toContain('raised no questions');
  });

  it('counts in singular where the number is one', () => {
    const { body } = describeApprovedPullRequest({
      ...base,
      keyCount: 1,
      locales: ['fr'],
      decisions: [{ state: 'resolved', resolvedText: null }],
    });
    expect(body).toContain('Extracted 1 string from');
    expect(body).toContain('into 1 locale.');
    expect(body).toContain('1 question answered');
  });

  it('omits the framework rather than naming it as null', () => {
    const { body } = describeApprovedPullRequest({ ...base, framework: null });
    expect(body).not.toContain('null');
    expect(body).toContain('Extracted 8 strings, translated');
  });
});
