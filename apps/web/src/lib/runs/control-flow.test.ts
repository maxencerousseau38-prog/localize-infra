import { describe, expect, it } from 'vitest';
import { isNextControlFlowError } from './control-flow';

describe('isNextControlFlowError', () => {
  /*
   * The three digests Next uses to move control, not to report a fault. A
   * catch that swallows one of these turns `redirect('/login')` into a
   * silently ignored no-op — which is the exact failure mode the catch calling
   * this function exists to fix, reintroduced one layer up.
   */
  it('recognises a redirect', () => {
    expect(
      isNextControlFlowError({ digest: 'NEXT_REDIRECT;replace;/login;' }),
    ).toBe(true);
  });

  it('recognises notFound', () => {
    expect(isNextControlFlowError({ digest: 'NEXT_NOT_FOUND' })).toBe(true);
  });

  it('recognises the http error fallback', () => {
    expect(
      isNextControlFlowError({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }),
    ).toBe(true);
  });

  it('does not claim a real error', () => {
    expect(isNextControlFlowError(new Error('GitHub said no'))).toBe(false);
  });

  /*
   * A thrown Error carries a `digest` in production Next builds — a hash of
   * the message, not a control-flow marker. Matching on "has a digest" rather
   * than on its value would classify every genuine server error as a redirect
   * and re-throw it, which is precisely the bug being fixed.
   */
  it('does not treat an arbitrary digest as control flow', () => {
    expect(isNextControlFlowError({ digest: '3163877705' })).toBe(false);
  });

  it('survives values that are not objects', () => {
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
    expect(isNextControlFlowError('NEXT_REDIRECT')).toBe(false);
    expect(isNextControlFlowError(42)).toBe(false);
  });

  it('ignores a non-string digest', () => {
    expect(isNextControlFlowError({ digest: 123 })).toBe(false);
  });
});
