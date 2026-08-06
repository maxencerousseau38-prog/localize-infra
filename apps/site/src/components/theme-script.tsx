import { THEME_SCRIPT } from '@/lib/theme-script';

/**
 * Applies the colour scheme before first paint.
 *
 * Without this, a dark-mode visitor sees a white flash on every navigation —
 * the most common "this feels cheap" tell on an otherwise polished site. It
 * must be inline and synchronous in <head>: a React effect runs too late, and
 * an external script still paints once first.
 *
 * Security: the content is a static build-time constant with no user input or
 * interpolation, and its SHA-256 is allowlisted in the CSP `script-src`
 * (see next.config.ts). This is the documented exception to the "no inline
 * scripts" rule in docs/frontend/06-frontend-architecture.md §9.
 *
 * Three-state preference (light / dark / system), never system-only: a user
 * whose OS is dark may still want this site light.
 */
export function ThemeScript() {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time constant, no interpolation, SHA-256 allowlisted in CSP (next.config.ts). Required to run before first paint; every alternative flashes.
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  );
}
