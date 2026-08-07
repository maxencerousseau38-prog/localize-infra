import { THEME_SCRIPT } from './theme';

/**
 * Renders the pre-paint colour-scheme script.
 *
 * `nonce` is required by apps whose CSP allows inline scripts by nonce rather
 * than by `'unsafe-inline'`. It is optional here rather than mandatory because
 * a nonce is meaningless — and omitting the attribute is correct — under a
 * policy that does not use one. Passing a stale or wrong nonce blocks the
 * script, which surfaces as the theme flash returning: a loud, visible failure
 * rather than a silent hole.
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time constant with no interpolation; must run before first paint, and every alternative flashes. See theme-script.ts.
    <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  );
}
