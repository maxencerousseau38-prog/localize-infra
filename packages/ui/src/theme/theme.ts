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
 * Four-state preference (light / dark / oled / system), never system-only: a
 * user whose OS is dark may still want this product light.
 *
 * `oled` sets **both** classes. It is a refinement of `dark`, not a rival to
 * it (DESIGN.md §6.4), so `.oled` only overrides the ground and every `dark:`
 * utility keeps working underneath. Setting `.oled` alone would strip the
 * state colours, which is the one thing the two schemes must share.
 */
export const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var o=t==='oled';var d=o||t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('oled',o);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();";

export type Theme = 'light' | 'dark' | 'oled' | 'system';

/** The single place the class and `color-scheme` are derived from a preference. */
export function applyTheme(theme: Theme) {
  const oled = theme === 'oled';
  const dark =
    oled ||
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const classes = document.documentElement.classList;
  classes.toggle('dark', dark);
  classes.toggle('oled', oled);
  // Still 'dark': `color-scheme` tells the browser how to paint scrollbars and
  // form controls, and it has two values. OLED is a dark scheme.
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function isTheme(value: unknown): value is Theme {
  return (
    value === 'light' ||
    value === 'dark' ||
    value === 'oled' ||
    value === 'system'
  );
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
