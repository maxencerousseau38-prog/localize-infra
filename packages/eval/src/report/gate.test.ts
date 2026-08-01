import { describe, expect, it } from 'vitest';
import { computeGate } from './gate.js';

describe('computeGate', () => {
  it('passes when B is preferred-or-equivalent to C in at least 3 of 5 locales at the 50% threshold', () => {
    const perLocale = new Map([
      ['de', { bPreferredOrEquivalentRate: 0.6 }],
      ['ja', { bPreferredOrEquivalentRate: 0.55 }],
      ['es', { bPreferredOrEquivalentRate: 0.51 }],
      ['ar', { bPreferredOrEquivalentRate: 0.4 }],
      ['pt-BR', { bPreferredOrEquivalentRate: 0.3 }],
    ]);
    const gate = computeGate(perLocale);
    expect(gate.passed).toBe(true);
    expect(gate.passingLocales).toEqual(['de', 'ja', 'es']);
  });

  it('fails when fewer than 3 of 5 locales clear the threshold', () => {
    const perLocale = new Map([
      ['de', { bPreferredOrEquivalentRate: 0.6 }],
      ['ja', { bPreferredOrEquivalentRate: 0.4 }],
      ['es', { bPreferredOrEquivalentRate: 0.3 }],
      ['ar', { bPreferredOrEquivalentRate: 0.2 }],
      ['pt-BR', { bPreferredOrEquivalentRate: 0.1 }],
    ]);
    expect(computeGate(perLocale).passed).toBe(false);
  });
});
