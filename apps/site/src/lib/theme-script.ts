/**
 * The pre-paint colour-scheme script.
 *
 * Lives in its own module for one reason: `next.config.ts` imports this exact
 * string to compute its SHA-256 for the Content-Security-Policy `script-src`
 * allowlist. Deriving the hash from the source guarantees the two can never
 * drift — if this string changes and the hash is stale, the browser blocks the
 * script and the theme flash returns, which is a loud, visible failure rather
 * than a silent CSP hole.
 *
 * Contents are a static build-time constant: no user input, no request data,
 * no interpolation. That is what makes hash-based allowlisting valid here.
 */
export const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();";
