/**
 * The pre-paint colour-scheme script.
 *
 * Applies the stored preference before first paint. Without it, a dark-mode
 * visitor sees a white flash on every navigation — the most common "this feels
 * cheap" tell on an otherwise polished product. It must be inline and
 * synchronous in `<head>`: a React effect runs too late, and an external script
 * still paints once first.
 *
 * Contents are a static build-time constant — no user input, no request data,
 * no interpolation. That is what makes it safe to allow at all, whether the
 * host app allows it by nonce (apps/web) or by a blanket `'unsafe-inline'`
 * (apps/site, which documents that trade in its next.config.ts).
 *
 * Three-state preference (light / dark / system), never system-only: a user
 * whose OS is dark may still want this product light.
 */
export const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();";

export type Theme = 'light' | 'dark' | 'system';

/** The single place the class and `color-scheme` are derived from a preference. */
export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}
