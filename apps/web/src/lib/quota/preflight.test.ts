import { describe, expect, it } from 'vitest';
import { type TranslationBudget, describeRunShortfall } from './preflight';

const known = (limit: number, used: number): TranslationBudget => ({
  limit,
  used,
  remaining: Math.max(0, limit - used),
  unknown: false,
});

const UNKNOWN: TranslationBudget = {
  limit: 0,
  used: 0,
  remaining: 0,
  unknown: true,
};

describe('describeRunShortfall', () => {
  it('allows a run that fits', () => {
    expect(describeRunShortfall(3_000, known(5_000, 0))).toBeNull();
  });

  it('allows a run that fits exactly, because the ceiling is inclusive', () => {
    // `consume_api_quota` refuses what would *exceed* the ceiling, so a run
    // landing precisely on it succeeds. Refusing here would stop a run the
    // database would have allowed.
    expect(describeRunShortfall(5_000, known(5_000, 0))).toBeNull();
  });

  it('refuses a run one pair past what is left', () => {
    const message = describeRunShortfall(2_001, known(5_000, 3_000));
    expect(message).toContain('2,001');
    expect(message).toContain('2,000');
    expect(message).toContain('00:00 UTC');
  });

  it('says nothing was charged, because that is the point of refusing early', () => {
    const message = describeRunShortfall(6_000, known(5_000, 0));
    expect(message).toContain('nothing was charged');
  });

  /*
   * The two refusals are not interchangeable. A run bigger than the entire
   * ceiling is not a waiting problem, and telling that reader to come back
   * after midnight would send them to repeat the same failure.
   */
  it('does not offer the reset to a run larger than the whole ceiling', () => {
    const message = describeRunShortfall(12_000, known(5_000, 0));
    expect(message).toContain('entire daily ceiling');
    expect(message).toContain('fewer languages');
    expect(message).not.toContain('00:00 UTC');
  });

  it('offers the reset to a run that only exceeds what is left today', () => {
    const message = describeRunShortfall(4_000, known(5_000, 2_000));
    expect(message).toContain('00:00 UTC');
    expect(message).not.toContain('entire daily ceiling');
  });

  /*
   * Fail-open, deliberately, and this is the assertion that pins it.
   *
   * `chargeWorkspace` still runs and still fails closed, so a silent preflight
   * costs nothing today's behaviour does not already cost. Refusing on an
   * unreadable counter would block runs on a check that has no authority.
   */
  it('has no opinion when the budget could not be read', () => {
    expect(describeRunShortfall(1_000_000, UNKNOWN)).toBeNull();
  });

  it('treats a spent-out workspace as zero remaining, not as unknown', () => {
    const message = describeRunShortfall(1, known(5_000, 5_000));
    expect(message).toContain('0 of today’s 5,000');
  });

  it('never claims a run was charged when it refuses', () => {
    for (const planned of [5_001, 10_000, 250_000]) {
      const message = describeRunShortfall(planned, known(5_000, 0));
      expect(message).not.toBeNull();
      expect(message).not.toMatch(/partial|translated \d/i);
    }
  });
});
