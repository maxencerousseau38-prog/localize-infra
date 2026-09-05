import { describe, expect, it } from 'vitest';
import { confirmsDeletion } from './deletion';

describe('confirmsDeletion', () => {
  it('accepts the slug, exactly', () => {
    expect(
      confirmsDeletion('localize-infra-test-2', 'localize-infra-test-2'),
    ).toBe(true);
  });

  /*
   * Surrounding whitespace is what a paste or a double-click leaves behind, and
   * refusing it would teach nothing — the person typed the right thing.
   */
  it('forgives surrounding whitespace', () => {
    expect(confirmsDeletion('  demo  ', 'demo')).toBe(true);
    expect(confirmsDeletion('demo\n', 'demo')).toBe(true);
  });

  /*
   * Case is not forgiven, and that is the point of the control.
   *
   * A confirmation exists to cost a deliberate act. Accepting `DEMO` for `demo`
   * makes it a formality, and this deletes every run and every proposal the
   * project ever recorded — 8 runs and 72 proposals on the only project that
   * exists today.
   */
  it('does not accept a different case', () => {
    expect(confirmsDeletion('DEMO', 'demo')).toBe(false);
    expect(confirmsDeletion('Demo', 'demo')).toBe(false);
  });

  it('does not accept a prefix, a suffix, or something near it', () => {
    expect(confirmsDeletion('demo-2', 'demo')).toBe(false);
    expect(confirmsDeletion('dem', 'demo')).toBe(false);
    expect(confirmsDeletion('my demo', 'demo')).toBe(false);
  });

  /*
   * The case that matters most, because it is the one a permissive
   * implementation gets wrong: nothing typed at all. A `startsWith` or an
   * `includes` would accept it against any slug.
   */
  it('refuses an empty confirmation', () => {
    expect(confirmsDeletion('', 'demo')).toBe(false);
    expect(confirmsDeletion('   ', 'demo')).toBe(false);
    expect(confirmsDeletion(undefined, 'demo')).toBe(false);
    expect(confirmsDeletion(null, 'demo')).toBe(false);
  });

  /*
   * And an empty slug never confirms anything, whatever was typed. A project
   * cannot have one, but a bug upstream could hand one here, and "" === ""
   * would then delete on an empty box.
   */
  it('refuses when there is no slug to match', () => {
    expect(confirmsDeletion('', '')).toBe(false);
    expect(confirmsDeletion('anything', '')).toBe(false);
  });
});
