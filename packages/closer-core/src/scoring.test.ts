import { describe, expect, it } from 'vitest';
import { DEFAULT_ICP_WEIGHTS, type IcpInputs, scoreIcp } from './scoring.js';

const inputs = (over: Partial<IcpInputs> = {}): IcpInputs => ({
  localeCount: 0,
  signalLabels: [],
  commitsInWindow: 0,
  windowDays: 30,
  painValue: 0,
  painConfidence: 0,
  ...over,
});

const points = (i: IcpInputs, component: string) =>
  scoreIcp(i).breakdown.find((c) => c.component === component)?.points;

describe('scoreIcp', () => {
  /*
   * The rule the database enforces, asserted here so it fails in a unit rather
   * than at the write. `closer_record_score` refuses a breakdown that does not
   * sum to the value claimed.
   */
  it('produces a breakdown that sums to the value, always', () => {
    for (const sample of [
      inputs(),
      inputs({ localeCount: 12, signalLabels: ['a', 'b', 'c'] }),
      inputs({ commitsInWindow: 200, painValue: 100, painConfidence: 0.8 }),
    ]) {
      const score = scoreIcp(sample);
      expect(score.breakdown.reduce((t, c) => t + c.points, 0)).toBe(
        score.value,
      );
    }
  });

  it('scores an empty company at zero', () => {
    const score = scoreIcp(inputs());
    expect(score.value).toBe(0);
    expect(score.confidence).toBe(0);
  });

  /*
   * The honesty rule this file exists for.
   *
   * Discovery reads repositories, so team size, international signals and
   * buying intent have no source. Dropping them would produce a number out of
   * seventy presented as one out of a hundred, and every company would look
   * worse than it is by exactly the amount nobody measured.
   */
  it('lists the components it cannot assess, at zero, with a reason', () => {
    const score = scoreIcp(inputs({ localeCount: 8 }));
    expect(score.notAssessed).toEqual([
      'team_fit',
      'international_signals',
      'buying_intent',
    ]);
    for (const name of score.notAssessed) {
      const component = score.breakdown.find((c) => c.component === name);
      expect(component?.points).toBe(0);
      expect(component?.why).toContain('Not assessed');
      // The maximum is still reported, so the gap is visible rather than
      // implied by a total that does not reach a hundred.
      expect(component?.max).toBeGreaterThan(0);
    }
  });

  it('reports how many points could be assessed at all', () => {
    const score = scoreIcp(inputs());
    expect(score.assessable).toBe(70);
    expect(score.assessable).toBeLessThan(100);
  });

  it('cannot exceed the assessable maximum, however extreme the inputs', () => {
    const score = scoreIcp(
      inputs({
        localeCount: 500,
        signalLabels: ['a', 'b', 'c', 'd', 'e', 'f'],
        commitsInWindow: 10_000,
        painValue: 100,
        painConfidence: 1,
      }),
    );
    expect(score.value).toBe(score.assessable);
  });

  describe('locales', () => {
    it('rewards more locales', () => {
      expect(
        points(inputs({ localeCount: 8 }), 'locale_count'),
      ).toBeGreaterThan(
        points(inputs({ localeCount: 2 }), 'locale_count') as number,
      );
    });

    /*
     * Full marks at eight, not at fifty. Two locales to eight is an experiment
     * becoming a commitment; eight to forty is mostly the same problem, larger.
     */
    it('stops rewarding beyond the point where the problem stops changing', () => {
      expect(points(inputs({ localeCount: 8 }), 'locale_count')).toBe(
        points(inputs({ localeCount: 40 }), 'locale_count'),
      );
    });
  });

  it('counts distinct kinds of machinery, not repetitions of one', () => {
    const one = points(
      inputs({ signalLabels: ['i18next', 'i18next', 'i18next'] }),
      'localization_complexity',
    );
    const three = points(
      inputs({ signalLabels: ['i18next', 'format.po', 'locale_directory'] }),
      'localization_complexity',
    );
    expect(three as number).toBeGreaterThan(one as number);
  });

  it('says plainly when there is no evidence of friction', () => {
    const component = scoreIcp(inputs({ localeCount: 5 })).breakdown.find(
      (c) => c.component === 'localization_pain',
    );
    expect(component?.points).toBe(0);
    expect(component?.why).toContain('no evidence');
  });

  /*
   * Confidence describes the inputs, not the arithmetic. A company scored
   * mostly on counting locales and commits is more trustworthy than one scored
   * mostly on inferred friction, and the number has to show that.
   */
  it('is more confident when the points came from counting than from inference', () => {
    const counted = scoreIcp(
      inputs({ localeCount: 8, commitsInWindow: 30, signalLabels: ['a', 'b'] }),
    );
    const inferred = scoreIcp(inputs({ painValue: 100, painConfidence: 0.5 }));
    expect(counted.confidence).toBeGreaterThan(inferred.confidence);
  });

  it('reaches full confidence when nothing was inferred', () => {
    const score = scoreIcp(inputs({ localeCount: 8, commitsInWindow: 30 }));
    expect(score.confidence).toBe(1);
  });

  it('honours weights it is given rather than the defaults', () => {
    const doubled = {
      ...DEFAULT_ICP_WEIGHTS,
      localeCount: DEFAULT_ICP_WEIGHTS.localeCount * 2,
    };
    const base = scoreIcp(inputs({ localeCount: 8 }));
    const heavier = scoreIcp(inputs({ localeCount: 8 }), doubled);
    expect(heavier.value).toBe(base.value * 2);
  });

  it('gives every component a reason, including the ones worth nothing', () => {
    for (const component of scoreIcp(inputs()).breakdown) {
      expect(component.why.trim()).not.toBe('');
    }
  });
});
