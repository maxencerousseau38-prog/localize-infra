/**
 * The password policy, in one place.
 *
 * It lives here rather than in `apps/web` because it is a contract: the web
 * app enforces it today, and anything else that ever creates an account — a
 * CLI login, the API — has to enforce exactly the same rule or the weakest
 * surface sets the real policy.
 *
 * ## Why length, and only length
 *
 * The stronger control is a breach check: Supabase Auth can reject passwords
 * found in the HaveIBeenPwned corpus, which catches `Tr0ub4dor&3` and every
 * other password that is complex by rule and known by list. That feature is
 * **Pro plan and above**, and this project's Supabase organisation is on the
 * free plan, so it is not available. This is the fallback, and it is weaker —
 * a longer minimum raises the cost of guessing, but a twelve-character
 * password that appears in a breach corpus still passes here.
 *
 * Deliberately absent: character-class requirements. NIST SP 800-63B stopped
 * recommending them because they push people towards predictable shapes —
 * `Password1!` satisfies upper, lower, digit and symbol, and is among the
 * first things any attacker tries. Length is the lever that actually costs an
 * attacker work, so length is the lever this uses.
 */

/**
 * Twelve, not eight.
 *
 * Eight was the old floor and it is now within reach of commodity hardware for
 * offline attacks. This only binds new passwords — see the note on sign-in in
 * the web app: a policy that gates *authentication* rather than *registration*
 * locks existing users out of their own accounts, which is an outage dressed
 * as a security improvement.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * bcrypt hashes at most 72 bytes and silently ignores the rest.
 *
 * That silence is the problem. Without this, a passphrase longer than 72 bytes
 * is accepted, truncated, and the characters past the limit do nothing — so
 * two different passwords can unlock the same account and nobody is told. The
 * limit is in bytes, not characters: an emoji or an accented letter costs more
 * than one, so a 40-character password can exceed it.
 */
export const MAXIMUM_PASSWORD_BYTES = 72;

export interface PasswordContext {
  /** Checked so the password cannot simply be the address it protects. */
  email?: string;
}

/**
 * Returns a sentence describing what is wrong, or `null` if the password is
 * acceptable.
 *
 * A string rather than a boolean because the caller has to tell the person
 * what to change, and a boolean forces every caller to invent that sentence
 * again — which is how two surfaces end up stating different rules.
 */
export function passwordProblem(
  password: string,
  context: PasswordContext = {},
): string | null {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }

  // TextEncoder rather than `.length`: the limit bcrypt applies is on bytes.
  if (new TextEncoder().encode(password).length > MAXIMUM_PASSWORD_BYTES) {
    return `Use at most ${MAXIMUM_PASSWORD_BYTES} bytes — longer passwords are silently truncated when hashed.`;
  }

  const email = context.email?.trim().toLowerCase();
  if (email) {
    const lowered = password.toLowerCase();
    if (lowered === email) {
      return 'Your password cannot be your email address.';
    }
    // The local part is the guessable half: everyone who knows the address
    // knows it, and it is the first thing a targeted guess tries.
    const localPart = email.split('@')[0];
    if (localPart && localPart.length >= 4 && lowered.includes(localPart)) {
      return 'Your password cannot contain your email address.';
    }
  }

  return null;
}
