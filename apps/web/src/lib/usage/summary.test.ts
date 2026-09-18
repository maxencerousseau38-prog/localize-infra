import { describe, expect, it } from 'vitest';
import {
  type UsageDay,
  type UsageLimits,
  buildUsageSummary,
  describeLastUsed,
  utcDate,
} from './summary.js';

/**
 * What the usage page is allowed to claim.
 *
 * The rule doing most of the work is the one that separates this file from
 * `lib/metrics/funnel.ts`, which refuses to print zero for anything: **here,
 * zero is measured.** `consume_api_quota` writes a row on first use of the day,
 * so no row means no spending — a fact — where a merge rate of 0% would be an
 * unasked question wearing a number.
 *
 * The other is that nothing is re-counted. Every figure traces to a row the
 * caller passed in; there is no path where a run or a proposal contributes to a
 * total the ceiling is enforced against.
 */

const LIMITS: UsageLimits = { strings_per_day: 5000, prs_per_day: 50 };

const day = (over: Partial<UsageDay> = {}): UsageDay => ({
  usage_date: '2026-09-18',
  strings_translated: 0,
  translate_requests: 0,
  prs_opened: 0,
  ...over,
});

describe('a workspace that has spent nothing', () => {
  const summary = buildUsageSummary([], LIMITS, '2026-09-18');

  it('reports zero, because zero is what the counters say', () => {
    expect(summary.today.strings).toBe(0);
    expect(summary.today.pullRequests).toBe(0);
    expect(summary.month.strings).toBe(0);
    expect(summary.month.activeDays).toBe(0);
  });

  it('is not at either ceiling', () => {
    expect(summary.atStringCeiling).toBe(false);
    expect(summary.atPullRequestCeiling).toBe(false);
  });

  it('still carries the limits, so the page has a denominator', () => {
    expect(summary.limits.strings_per_day).toBe(5000);
    expect(summary.limits.prs_per_day).toBe(50);
  });
});

describe('today is today, in UTC', () => {
  const days = [
    day({ usage_date: '2026-09-18', strings_translated: 30, prs_opened: 1 }),
    day({ usage_date: '2026-09-17', strings_translated: 400, prs_opened: 2 }),
    day({ usage_date: '2026-09-01', strings_translated: 7, prs_opened: 0 }),
  ];
  const summary = buildUsageSummary(days, LIMITS, '2026-09-18');

  it('counts only the day asked for', () => {
    expect(summary.today.strings).toBe(30);
    expect(summary.today.pullRequests).toBe(1);
  });

  it('sums the whole month for the month total', () => {
    expect(summary.month.strings).toBe(437);
    expect(summary.month.pullRequests).toBe(3);
  });

  it('counts a day as active only if something was spent on it', () => {
    const withQuiet = buildUsageSummary(
      [...days, day({ usage_date: '2026-09-10' })],
      LIMITS,
      '2026-09-18',
    );
    expect(withQuiet.month.activeDays).toBe(3);
  });

  it('excludes another month entirely', () => {
    const summaryWithAugust = buildUsageSummary(
      [...days, day({ usage_date: '2026-08-31', strings_translated: 9999 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summaryWithAugust.month.strings).toBe(437);
  });

  it('names the day it is reporting on', () => {
    expect(summary.todayDate).toBe('2026-09-18');
  });
});

describe('the ceiling is reached, not merely approached', () => {
  it('is not reached one string below', () => {
    const summary = buildUsageSummary(
      [day({ strings_translated: 4999 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summary.atStringCeiling).toBe(false);
  });

  it('is reached exactly on it, because the next string is refused', () => {
    // consume_api_quota enforces `used + units > limit`, so sitting on the
    // limit already means refused. Reporting "not reached" here would
    // contradict the refusal the API is about to give.
    const summary = buildUsageSummary(
      [day({ strings_translated: 5000 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summary.atStringCeiling).toBe(true);
  });

  it('is reached above it, which a lowered limit could produce', () => {
    const summary = buildUsageSummary(
      [day({ strings_translated: 6000 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summary.atStringCeiling).toBe(true);
  });

  it('tracks the two ceilings apart', () => {
    const summary = buildUsageSummary(
      [day({ strings_translated: 5000, prs_opened: 1 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summary.atStringCeiling).toBe(true);
    expect(summary.atPullRequestCeiling).toBe(false);
  });

  it('reaches the pull-request ceiling on its own number', () => {
    const summary = buildUsageSummary(
      [day({ prs_opened: 50 })],
      LIMITS,
      '2026-09-18',
    );
    expect(summary.atPullRequestCeiling).toBe(true);
  });
});

describe('the UTC day', () => {
  it('is the date part of the ISO string, not the local one', () => {
    // 23:30 UTC on the 18th is the 19th in Paris. `usage_date` is UTC, so this
    // must stay the 18th or the page would read a row that does not exist.
    expect(utcDate(new Date('2026-09-18T23:30:00.000Z'))).toBe('2026-09-18');
    expect(utcDate(new Date('2026-09-19T00:05:00.000Z'))).toBe('2026-09-19');
  });
});

describe('when a token was last used', () => {
  const now = new Date('2026-09-18T20:00:00.000Z');

  it('says never, rather than borrowing a creation date', () => {
    expect(describeLastUsed(null, now)).toBe('Never used');
  });

  it('reads as a wait a person recognises', () => {
    expect(describeLastUsed('2026-09-18T19:59:40.000Z', now)).toBe('Just now');
    expect(describeLastUsed('2026-09-18T19:30:00.000Z', now)).toBe(
      '30 min ago',
    );
    expect(describeLastUsed('2026-09-18T14:00:00.000Z', now)).toBe('6h ago');
    expect(describeLastUsed('2026-09-15T20:00:00.000Z', now)).toBe('3d ago');
  });

  it('falls back to a date once relative time stops helping', () => {
    expect(describeLastUsed('2026-06-01T10:00:00.000Z', now)).toBe(
      '2026-06-01',
    );
  });

  it('does not report a future timestamp as a negative age', () => {
    expect(describeLastUsed('2026-09-19T10:00:00.000Z', now)).toBe(
      'Never used',
    );
  });

  it('survives an unparseable value instead of printing NaN', () => {
    expect(describeLastUsed('not-a-date', now)).toBe('Never used');
  });
});
