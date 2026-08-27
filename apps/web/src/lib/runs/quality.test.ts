import { describe, expect, it } from 'vitest';
import {
  type LocaleProposal,
  checkTranslations,
  describeFindings,
} from './quality.js';

/**
 * The gate that stands between a model's output and somebody's repository.
 *
 * Written because the checks it composes were tested, gated in CI at 99.5%, and
 * ran nowhere near the code that opens a pull request. What is asserted here is
 * not that the checks work — `packages/eval` already asserts that — but that
 * the composition refuses the right things and, just as importantly, does not
 * refuse the wrong ones. A false failure blocks a developer's pull request,
 * which is the more expensive mistake of the two.
 */

const proposal = (
  locale: string,
  entries: Record<string, string>,
): LocaleProposal[] => [{ locale, entries }];

describe('checkTranslations', () => {
  it('passes an ordinary translation', () => {
    const report = checkTranslations(
      { 'cart.empty': 'Your cart is empty' },
      proposal('fr', { 'cart.empty': 'Votre panier est vide' }),
    );
    expect(report.passed).toBe(true);
    expect(report.checked).toBe(1);
  });

  describe('placeholders', () => {
    it('refuses a translation that dropped one', () => {
      const report = checkTranslations(
        { greeting: 'Hello {{name}}' },
        proposal('fr', { greeting: 'Bonjour' }),
      );
      expect(report.passed).toBe(false);
      expect(report.findings[0]?.check).toBe('placeholders');
    });

    /*
     * The failure this gate exists for. A renamed placeholder looks like a
     * translation and is a runtime error: the code passes `count`, the string
     * asks for `compte`.
     */
    it('refuses a translation that renamed one', () => {
      const report = checkTranslations(
        { items: 'You have %{count} items' },
        proposal('fr', { items: 'Vous avez %{compte} articles' }),
      );
      expect(report.passed).toBe(false);
      expect(report.findings[0]?.detail).toContain('%{compte}');
    });

    it('accepts a placeholder that moved, because word order is the point', () => {
      const report = checkTranslations(
        { greeting: 'Hello {{name}}, welcome' },
        proposal('de', { greeting: 'Willkommen, {{name}}' }),
      );
      expect(report.passed).toBe(true);
    });
  });

  describe('ICU', () => {
    it('refuses a malformed ICU message', () => {
      const report = checkTranslations(
        { n: '{count, plural, one {# item} other {# items}}' },
        proposal('fr', {
          n: '{count, plural, one {# article} other {# articles}',
        }),
      );
      expect(report.passed).toBe(false);
      expect(report.findings[0]?.check).toBe('icu');
    });

    it('accepts a well-formed one', () => {
      const report = checkTranslations(
        { n: '{count, plural, one {# item} other {# items}}' },
        proposal('fr', {
          n: '{count, plural, one {# article} other {# articles}}',
        }),
      );
      expect(report.passed).toBe(true);
    });

    /*
     * A brace in an ordinary string must not be parsed as ICU. Running the ICU
     * parser over everything would reject good translations and block a pull
     * request for a reason nobody could act on.
     */
    it('does not treat an ordinary string containing a brace as ICU', () => {
      const report = checkTranslations(
        { code: 'Use the { key' },
        proposal('fr', { code: 'Utilisez la touche {' }),
      );
      expect(report.passed).toBe(true);
    });
  });

  it('skips a key the source catalog does not have', () => {
    const report = checkTranslations(
      { known: 'Known' },
      proposal('fr', { known: 'Connu', orphan: 'Orphelin' }),
    );
    expect(report.checked).toBe(1);
    expect(report.passed).toBe(true);
  });

  it('reports every locale, not just the first that failed', () => {
    const report = checkTranslations({ greeting: 'Hello {{name}}' }, [
      { locale: 'fr', entries: { greeting: 'Bonjour' } },
      { locale: 'de', entries: { greeting: 'Hallo' } },
    ]);
    expect(report.findings).toHaveLength(2);
    expect(report.findings.map((f) => f.locale)).toEqual(['fr', 'de']);
  });

  it('counts what it examined, so an empty run is distinguishable from a clean one', () => {
    expect(checkTranslations({}, []).checked).toBe(0);
    expect(checkTranslations({}, []).passed).toBe(true);
  });
});

describe('describeFindings', () => {
  it('says nothing when there is nothing to say', () => {
    expect(describeFindings({ checked: 3, findings: [], passed: true })).toBe(
      '',
    );
  });

  /*
   * A run that broke two hundred strings has one problem, not two hundred, and
   * a message nobody reads to the end explains nothing.
   */
  it('caps the list and says how much it left out', () => {
    const findings = Array.from({ length: 9 }, (_, i) => ({
      locale: 'fr',
      key: `k${i}`,
      check: 'placeholders' as const,
      detail: 'x',
    }));
    const text = describeFindings({ checked: 9, findings, passed: false }, 5);
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toContain('…and 4 more');
  });

  it('names the locale, the key and the check on every line', () => {
    const text = describeFindings({
      checked: 1,
      passed: false,
      findings: [
        {
          locale: 'de',
          key: 'cart.total',
          check: 'placeholders',
          detail: 'lost %s',
        },
      ],
    });
    expect(text).toContain('de');
    expect(text).toContain('cart.total');
    expect(text).toContain('placeholders');
  });
});
