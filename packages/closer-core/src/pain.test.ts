import { describe, expect, it } from 'vitest';
import {
  type CommitRecord,
  type PainInput,
  detectPain,
  painScore,
} from './pain.js';

const NOW = new Date('2026-08-24T00:00:00Z');

function commits(count: number, message = 'update strings'): CommitRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(NOW.getTime() - i * 86_400_000).toISOString(),
    message,
  }));
}

const input = (over: Partial<PainInput> = {}): PainInput => ({
  localeCommits: [],
  allCommits: [],
  windowDays: 30,
  lastPushedAt: NOW.toISOString(),
  now: NOW,
  ...over,
});

const labels = (i: PainInput) => detectPain(i).map((e) => e.label);

describe('detectPain', () => {
  /*
   * The distinction the whole file exists for. A repository can carry every
   * localisation signal there is and still show no sign that anybody is doing
   * the work — nine locales finished two years ago is a solved problem, not a
   * prospect.
   */
  it('finds nothing in a repository with no translation activity', () => {
    expect(labels(input({ allCommits: commits(40) }))).toEqual([]);
  });

  it('says nothing about one or two translation commits', () => {
    expect(labels(input({ localeCommits: commits(2) }))).toEqual([]);
  });

  it('counts repeated translation commits, with the window', () => {
    const found = detectPain(input({ localeCommits: commits(7) }));
    const frequency = found.find(
      (e) => e.label === 'translation_commit_frequency',
    );
    expect(frequency?.summary).toContain('7 commits');
    expect(frequency?.summary).toContain('30 days');
  });

  it('treats ten commits as worse than four', () => {
    const few = detectPain(input({ localeCommits: commits(4) })).find(
      (e) => e.label === 'translation_commit_frequency',
    );
    const many = detectPain(input({ localeCommits: commits(12) })).find(
      (e) => e.label === 'translation_commit_frequency',
    );
    expect(few?.severity).toBe('low');
    expect(many?.severity).toBe('high');
    expect(many?.confidence as number).toBeGreaterThan(
      few?.confidence as number,
    );
  });

  /*
   * Twelve translation commits in a repository with twelve hundred is noise.
   * The ratio is what separates a team spending real time on this from one
   * that merely has locale files.
   */
  it('reports translation work as a share of all commits', () => {
    const found = detectPain(
      input({ localeCommits: commits(10), allCommits: commits(30) }),
    );
    const share = found.find((e) => e.label === 'translation_share_of_commits');
    expect(share?.summary).toContain('33%');
    expect(share?.summary).toContain('10 of 30');
  });

  it('does not compute a share when there is too little activity to divide', () => {
    expect(
      labels(input({ localeCommits: commits(5), allCommits: commits(8) })),
    ).not.toContain('translation_share_of_commits');
  });

  it('does not report a share that is a rounding of a busy repository', () => {
    expect(
      labels(input({ localeCommits: commits(4), allCommits: commits(500) })),
    ).not.toContain('translation_share_of_commits');
  });

  it('notices commits that name translation work', () => {
    const found = detectPain(
      input({
        localeCommits: [
          { date: NOW.toISOString(), message: 'add Spanish translations' },
          { date: NOW.toISOString(), message: 'sync i18n keys' },
        ],
      }),
    );
    const deliberate = found.find(
      (e) => e.label === 'deliberate_translation_work',
    );
    expect(deliberate?.summary).toContain('add Spanish translations');
  });

  it('does not read an unrelated message as translation work', () => {
    expect(
      labels(
        input({
          localeCommits: [
            { date: NOW.toISOString(), message: 'refactor button styles' },
            { date: NOW.toISOString(), message: 'bump dependencies' },
          ],
        }),
      ),
    ).not.toContain('deliberate_translation_work');
  });

  it('flags a commit that says the work was manual, less confidently', () => {
    const found = detectPain(
      input({
        localeCommits: [
          { date: NOW.toISOString(), message: 'manually fix German copy' },
        ],
      }),
    );
    const manual = found.find((e) => e.label === 'manual_translation_work');
    expect(manual).toBeDefined();
    // A message is what somebody typed, not what they did.
    expect(manual?.confidence as number).toBeLessThan(0.7);
  });

  describe('staleness', () => {
    const old = (days: number) =>
      new Date(NOW.getTime() - days * 86_400_000).toISOString();

    it('reports translations that lag a repository still being pushed to', () => {
      const found = detectPain(
        input({
          localeCommits: [{ date: old(200), message: 'update strings' }],
          lastPushedAt: old(2),
        }),
      );
      const stale = found.find((e) => e.label === 'stale_translations');
      expect(stale?.severity).toBe('high');
      expect(stale?.summary).toContain('200 days');
    });

    /*
     * A repository nobody has touched at all is not a repository whose
     * translations are behind. Reporting one as the other would put an
     * abandoned project on a prospect list.
     */
    it('says nothing when the whole repository is equally old', () => {
      expect(
        labels(
          input({
            localeCommits: [{ date: old(200), message: 'update strings' }],
            lastPushedAt: old(200),
          }),
        ),
      ).not.toContain('stale_translations');
    });

    it('ignores a gap that is ordinary release rhythm', () => {
      expect(
        labels(
          input({
            localeCommits: [{ date: old(35), message: 'update strings' }],
            lastPushedAt: old(1),
          }),
        ),
      ).not.toContain('stale_translations');
    });
  });

  it('never claims certainty: every pain item is an inference', () => {
    const found = detectPain(
      input({ localeCommits: commits(12), allCommits: commits(30) }),
    );
    expect(found.length).toBeGreaterThan(0);
    for (const item of found) {
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThan(1);
    }
  });
});

describe('painScore', () => {
  it('is zero with no evidence, and carries no confidence', () => {
    const score = painScore([]);
    expect(score.value).toBe(0);
    expect(score.confidence).toBe(0);
    expect(score.breakdown).toEqual([]);
  });

  /*
   * The database refuses a score whose breakdown does not sum to the value
   * claimed. That check is the difference between an explainable number and a
   * number with a decorative list beside it, so it is asserted here too.
   */
  it('produces a breakdown that sums to the value', () => {
    const score = painScore(
      detectPain(
        input({ localeCommits: commits(12), allCommits: commits(30) }),
      ),
    );
    const sum = score.breakdown.reduce((total, c) => total + c.points, 0);
    expect(sum).toBe(score.value);
  });

  it('caps at 100 by trimming the last component, not by scaling them all', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      label: `item_${i}`,
      summary: 'x',
      severity: 'high' as const,
      confidence: 0.8,
    }));
    const score = painScore(many);
    expect(score.value).toBe(100);
    expect(score.breakdown.reduce((t, c) => t + c.points, 0)).toBe(100);
    // The kept components keep the points the rule gives them; only the last
    // one is trimmed. Scaling would make identical evidence worth different
    // points in two companies.
    expect(score.breakdown[0]?.points).toBe(25);
  });

  it('averages the confidence of the evidence behind it', () => {
    const score = painScore([
      { label: 'a', summary: 'x', severity: 'low', confidence: 0.6 },
      { label: 'b', summary: 'y', severity: 'low', confidence: 0.8 },
    ]);
    expect(score.confidence).toBeCloseTo(0.7, 3);
  });

  it('gives every component a reason a reader can check', () => {
    const score = painScore(
      detectPain(input({ localeCommits: commits(7), allCommits: commits(30) })),
    );
    for (const component of score.breakdown) {
      expect(component.why.trim()).not.toBe('');
      expect(component.max).toBeGreaterThanOrEqual(component.points);
    }
  });
});
