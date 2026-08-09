/**
 * The configuration the CLI actually uses today.
 *
 * This is not sample data. Every value here is a real default read from
 * `packages/cli` and `packages/core`, and a test in `packages/schemas` fails
 * the build if any of them drifts from the source.
 *
 * Why Settings shows this rather than form controls: the other surfaces have no
 * backend and show *data*, so labelled sample data demonstrates their shape
 * honestly. Settings shows *controls*, and a toggle that silently fails to save
 * is a worse lie than an empty page — it invites an action and swallows it.
 *
 * But configuration does exist today. It lives in flags and environment
 * variables, and getting it wrong is the most common way a first run fails. So
 * this surface reports the real effective configuration read-only, with the
 * exact flag or variable that changes each value. Nothing here claims to be
 * editable from the browser, because nothing here is.
 */

export interface ConfigEntry {
  name: string;
  /** The effective value when nothing is passed. */
  value: string;
  /** How you actually change it today. */
  setWith: string;
  description: string;
}

export const TRANSLATION_CONFIG: ConfigEntry[] = [
  {
    name: 'Target locales',
    value: 'de, ja, es, ar, pt-BR',
    setWith: '--locales <comma,separated>',
    description:
      'Languages every run translates into. Chosen for spread across writing systems and text direction rather than for reach.',
  },
  {
    name: 'Locale directory',
    value: 'locales/',
    setWith: 'Not configurable',
    description:
      'Where locale files are read and written, relative to the project root. The same for every supported framework.',
  },
  {
    name: 'Source of truth',
    value: 'locales/en.json',
    setWith: 'Not configurable',
    description:
      'Freshly extracted text always wins here. For every other locale, a translation you edited by hand is never overwritten.',
  },
];

export const CONNECTION_CONFIG: ConfigEntry[] = [
  {
    name: 'API URL',
    value: 'http://localhost:8787',
    setWith: '--api-url <url>',
    description:
      'The API instance that performs translation. There is no hosted one — you run it yourself. No environment variable exists for this today.',
  },
  {
    name: 'API token',
    value: 'Not set',
    setWith: 'LOCALIZE_API_TOKEN',
    description:
      'Bearer token sent to that API. Prefer the environment variable: --api-token puts the secret in your shell history and in ps output.',
  },
];

export const PULL_REQUEST_CONFIG: ConfigEntry[] = [
  {
    name: 'Open a pull request',
    value: 'Off',
    setWith: '--open-pr',
    description:
      'Off by default. When on, --owner and --repo are required and validated before the translation step, so a typo costs nothing.',
  },
  {
    name: 'Base branch',
    value: 'main',
    setWith: '--base-branch <branch>',
    description: 'The branch the pull request targets.',
  },
];

export const DETECTED_FRAMEWORKS = [
  { name: 'Next.js', signal: 'a next dependency, or a next.config file' },
  {
    name: 'Vite + React',
    signal: 'a react dependency and either vite or a vite.config file',
  },
  { name: 'React Native', signal: 'a react-native dependency' },
];
