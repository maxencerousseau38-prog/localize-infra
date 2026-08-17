import { describe, expect, it } from 'vitest';
import {
  MAXIMUM_PASSWORD_BYTES,
  MINIMUM_PASSWORD_LENGTH,
  passwordProblem,
} from './password.js';

describe('passwordProblem', () => {
  it('accepts a password at exactly the minimum', () => {
    const password = 'a'.repeat(MINIMUM_PASSWORD_LENGTH);
    expect(passwordProblem(password)).toBeNull();
  });

  it('rejects one character below the minimum', () => {
    const password = 'a'.repeat(MINIMUM_PASSWORD_LENGTH - 1);
    expect(passwordProblem(password)).toBe(
      `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  });

  it('rejects the old eight-character floor', () => {
    // The point of the change: what used to pass must now fail, or the raise
    // did not happen.
    expect(passwordProblem('12345678')).not.toBeNull();
  });

  describe('the bcrypt byte limit', () => {
    it('accepts a password at exactly the limit', () => {
      expect(passwordProblem('a'.repeat(MAXIMUM_PASSWORD_BYTES))).toBeNull();
    });

    it('rejects one byte over, rather than letting it be truncated', () => {
      const problem = passwordProblem('a'.repeat(MAXIMUM_PASSWORD_BYTES + 1));
      expect(problem).toMatch(/truncated/);
    });

    it('counts bytes, not characters', () => {
      // A 40-character French passphrase: 40 characters, 80 bytes, because
      // every 'é' costs two. Counting characters would wave this through and
      // bcrypt would then quietly ignore the tail of it.
      const password = 'é'.repeat(40);
      expect(password.length).toBeLessThan(MAXIMUM_PASSWORD_BYTES);
      expect(new TextEncoder().encode(password).length).toBeGreaterThan(
        MAXIMUM_PASSWORD_BYTES,
      );
      expect(passwordProblem(password)).toMatch(/bytes/);
    });
  });

  describe('against the email address', () => {
    it('rejects the address itself', () => {
      expect(
        passwordProblem('person@example.com', { email: 'person@example.com' }),
      ).toBe('Your password cannot be your email address.');
    });

    it('rejects a password containing the local part', () => {
      expect(
        passwordProblem('margaret-and-more', { email: 'margaret@example.com' }),
      ).toBe('Your password cannot contain your email address.');
    });

    it('ignores case and surrounding whitespace on the address', () => {
      expect(
        passwordProblem('MARGARET-and-more', {
          email: '  Margaret@Example.com  ',
        }),
      ).toBe('Your password cannot contain your email address.');
    });

    it('does not reject on a local part too short to be meaningful', () => {
      // A three-letter local part like "ann" appears inside innocent words;
      // rejecting on it would refuse reasonable passwords for no gain.
      expect(
        passwordProblem('annotation-server', { email: 'ann@example.com' }),
      ).toBeNull();
    });

    it('accepts an unrelated password of sufficient length', () => {
      expect(
        passwordProblem('correct-horse-battery', {
          email: 'person@example.com',
        }),
      ).toBeNull();
    });
  });

  it('reports length before anything else', () => {
    // A short password that also contains the email should say "too short":
    // fixing the length is the instruction that matters.
    expect(passwordProblem('person', { email: 'person@example.com' })).toBe(
      `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  });
});
