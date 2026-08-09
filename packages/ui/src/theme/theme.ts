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

/**
 * Broadcast when the preference changes, so every mounted control agrees.
 *
 * Without this, two surfaces can set the theme and disagree about it: the
 * toggle reads localStorage once on mount, so a change made from the command
 * palette would leave its radio showing the previous value until a reload.
 * Anything that changes the theme goes through `setTheme`; anything that
 * displays it subscribes.
 */
const THEME_EVENT = 'localize-infra:theme';

/** The one way to change the preference. Persists, applies, and announces. */
export function setTheme(theme: Theme) {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

/** Current stored preference, defaulting to `system` when nothing is set. */
export function readTheme(): Theme {
  const stored = localStorage.getItem('theme');
  return isTheme(stored) ? stored : 'system';
}

/** Returns an unsubscribe function, for use from an effect. */
export function subscribeToTheme(onChange: (theme: Theme) => void): () => void {
  const handler = (event: Event) => {
    const next = (event as CustomEvent<Theme>).detail;
    if (isTheme(next)) onChange(next);
  };
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}
