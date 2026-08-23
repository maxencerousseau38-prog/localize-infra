import { readFileSync } from 'node:fs';
import { AmbiguityCaseSchema } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { AMBIGUITY_CASES_PATH, renderAmbiguityCases } from './build.js';
import { buildAmbiguityCases } from './cases.js';

const cases = buildAmbiguityCases();

describe('the ambiguity corpus', () => {
  /*
   * The same guard `benchmarks.json` and `cost-model.json` carry. A corpus
   * regenerated on every run can drift between two measurements, and then a
   * score that moved says nothing about whether the agent moved.
   */
  it('matches the committed file', () => {
    expect(readFileSync(AMBIGUITY_CASES_PATH, 'utf-8')).toBe(
      renderAmbiguityCases(),
    );
  });

  it('parses against the schema, every row', () => {
    for (const testCase of cases) {
      expect(() => AmbiguityCaseSchema.parse(testCase)).not.toThrow();
    }
  });

  it('holds 200 cases, balanced', () => {
    expect(cases).toHaveLength(200);
    expect(cases.filter((c) => c.expected === 'escalate')).toHaveLength(100);
    expect(cases.filter((c) => c.expected === 'confident')).toHaveLength(100);
  });

  it('gives every case a unique id', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  /*
   * The design guarantee, asserted rather than described.
   *
   * If anything other than `surroundingCode` differed between the halves of a
   * pair, a difference in the agent's answer could be attributed to that
   * instead, and the pair-discrimination number would stop meaning what it
   * claims to mean.
   */
  describe('each pair differs in the context and nothing else', () => {
    const pairIds = [...new Set(cases.map((c) => c.pairId))];

    it('has exactly one escalate and one confident half per pair', () => {
      expect(pairIds).toHaveLength(100);
      for (const pairId of pairIds) {
        const halves = cases.filter((c) => c.pairId === pairId);
        expect(halves).toHaveLength(2);
        expect(halves.filter((c) => c.expected === 'escalate')).toHaveLength(1);
        expect(halves.filter((c) => c.expected === 'confident')).toHaveLength(
          1,
        );
      }
    });

    it('holds source text, locale, category and component constant', () => {
      for (const pairId of pairIds) {
        const [a, b] = cases.filter((c) => c.pairId === pairId);
        if (!a || !b) throw new Error(`incomplete pair ${pairId}`);
        expect(a.sourceText).toBe(b.sourceText);
        expect(a.targetLocale).toBe(b.targetLocale);
        expect(a.category).toBe(b.category);
        expect(a.componentName).toBe(b.componentName);
      }
    });

    it('varies the surrounding code, which is the whole point', () => {
      for (const pairId of pairIds) {
        const [a, b] = cases.filter((c) => c.pairId === pairId);
        if (!a || !b) throw new Error(`incomplete pair ${pairId}`);
        expect(a.surroundingCode).not.toBe(b.surroundingCode);
      }
    });

    it('gives each half its own rationale', () => {
      for (const pairId of pairIds) {
        const [a, b] = cases.filter((c) => c.pairId === pairId);
        if (!a || !b) throw new Error(`incomplete pair ${pairId}`);
        expect(a.rationale).not.toBe(b.rationale);
      }
    });
  });

  /*
   * A bare adjective is only underdetermined in a language that inflects it,
   * and a formality choice only exists where the language forces one. Putting
   * a grammar case in Japanese would be scoring the agent against a problem
   * that is not there.
   */
  it('restricts grammar cases to locales that inflect for agreement', () => {
    const locales = new Set(
      cases
        .filter((c) => c.category === 'insufficient-grammar')
        .map((c) => c.targetLocale),
    );
    expect([...locales].sort()).toEqual(['ar', 'de', 'es', 'pt-BR']);
  });

  it('restricts register cases to locales that force a formality choice', () => {
    const locales = new Set(
      cases.filter((c) => c.category === 'register').map((c) => c.targetLocale),
    );
    expect([...locales].sort()).toEqual(['de', 'es', 'ja']);
  });

  it('covers all three categories the production prompt declares', () => {
    const counts = new Map<string, number>();
    for (const c of cases) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    expect(counts.get('polysemy')).toBe(120);
    expect(counts.get('insufficient-grammar')).toBe(50);
    expect(counts.get('register')).toBe(30);
  });

  it('puts the string under test inside its own surrounding code', () => {
    for (const testCase of cases) {
      expect(testCase.surroundingCode).toContain(
        JSON.stringify(testCase.sourceText),
      );
    }
  });
});
