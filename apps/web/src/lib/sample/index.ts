/**
 * Sample data for surfaces that have no backend yet.
 *
 * READ THIS BEFORE ADDING ANYTHING HERE.
 *
 * There is no database, no account, and no persisted project (CLAUDE.md). Six
 * of this app's routes therefore have nothing real to render. The project's
 * standing rule is that invented data must never be presented as real — and the
 * earlier answer to that was a placeholder page on every route, which honoured
 * the rule by abandoning the design.
 *
 * The rule this file follows instead: show the real, final interface, populated
 * with data labelled as sample at three levels at once —
 *
 *   1. a non-dismissible banner naming what is sample and what would be real,
 *   2. a `Sample` chip in the breadcrumb on every sample route,
 *   3. a dashed leading edge on sample regions, visually distinct from the
 *      solid State Rule so a sample row cannot read as a real one.
 *
 * The lie the project forbids is invented data presented as real. An interface
 * labelled three times as sample is the opposite of that.
 *
 * Every shape here is typed against what the real API will return, so switching
 * to live data is a data-source change and not a redesign.
 */

export type ConfidenceState =
  | 'ambiguous'
  | 'confident'
  | 'degraded'
  | 'failed'
  | 'neutral';

export interface SampleString {
  id: string;
  key: string;
  source: string;
  sourceLocale: string;
  translation?: string;
  targetLocale: string;
  state: ConfidenceState;
  stateLabel: string;
  origin: string;
  context?: string;
  approved?: boolean;
}

export interface SampleAmbiguity extends SampleString {
  /** Why the agent refused to guess. Shown verbatim — it is the whole point. */
  question: string;
  candidates: Array<{ text: string; rationale: string }>;
}

export interface SampleRun {
  id: string;
  state: 'succeeded' | 'partial' | 'failed';
  trigger: string;
  locales: number;
  localesFailed: number;
  strings: number;
  durationMs: number;
  prNumber?: number;
  prMerged?: boolean;
  when: string;
}

export interface SampleLocale {
  code: string;
  translated: number;
  total: number;
  needsReview: number;
  lastRun: string;
  state: ConfidenceState;
}

/* ── Ambiguity queue ───────────────────────────────────────────
   Every example is a real class of localization ambiguity, not
   filler: part-of-speech, honorific level, gendered agreement,
   and a term that must not be translated at all.
   ───────────────────────────────────────────────────────────── */
export const SAMPLE_AMBIGUITIES: SampleAmbiguity[] = [
  {
    id: 'amb-1',
    key: 'toolbar.open',
    source: 'Open',
    sourceLocale: 'en',
    targetLocale: 'ja',
    state: 'ambiguous',
    stateLabel: 'Needs a decision',
    origin: 'src/components/Toolbar.tsx',
    context: 'Button label beside Save and Close',
    question:
      'Verb or adjective? Japanese uses different words, and the surrounding code does not disambiguate.',
    candidates: [
      {
        text: '開く',
        rationale: 'Verb — "to open". Correct if this button opens something.',
      },
      {
        text: '営業中',
        rationale: 'Adjective — "currently open", as in open for business.',
      },
    ],
  },
  {
    id: 'amb-2',
    key: 'account.deleteConfirm',
    source: 'Are you sure you want to delete your account?',
    sourceLocale: 'en',
    targetLocale: 'de',
    state: 'ambiguous',
    stateLabel: 'Needs a decision',
    origin: 'src/features/account/DangerZone.tsx',
    context: 'Destructive confirmation dialog',
    question:
      'Formal or informal address? German requires choosing, and the rest of this product is inconsistent.',
    candidates: [
      {
        text: 'Möchten Sie Ihr Konto wirklich löschen?',
        rationale:
          'Formal (Sie) — matches 78% of your existing German strings.',
      },
      {
        text: 'Möchtest du dein Konto wirklich löschen?',
        rationale: 'Informal (du) — matches your marketing copy.',
      },
    ],
  },
  {
    id: 'amb-3',
    key: 'billing.planName',
    source: 'Team',
    sourceLocale: 'en',
    targetLocale: 'pt-BR',
    state: 'ambiguous',
    stateLabel: 'Needs a decision',
    origin: 'src/features/billing/PlanCard.tsx',
    context: 'Plan name in a pricing table',
    question:
      'Product name or common noun? If "Team" is the name of your plan it should not be translated.',
    candidates: [
      {
        text: 'Team',
        rationale: 'Leave untranslated — it is a proper noun naming your plan.',
      },
      {
        text: 'Equipe',
        rationale: 'Translate — it is describing a group of people.',
      },
    ],
  },
];

/* ── Review queue (non-developer surface) ──────────────────── */
export const SAMPLE_REVIEW: SampleString[] = [
  {
    id: 'rev-1',
    key: 'onboarding.welcome',
    source: 'Welcome back',
    sourceLocale: 'en',
    translation: 'Bon retour',
    targetLocale: 'fr',
    state: 'confident',
    stateLabel: 'Suggested',
    origin: 'src/app/(auth)/page.tsx',
    context: 'Greeting on the sign-in screen',
  },
  {
    id: 'rev-2',
    key: 'settings.save',
    source: 'Save changes',
    sourceLocale: 'en',
    translation: 'Änderungen speichern',
    targetLocale: 'de',
    state: 'confident',
    stateLabel: 'Suggested',
    origin: 'src/components/Form.tsx',
  },
  {
    id: 'rev-3',
    key: 'errors.network',
    source: 'Could not reach the server',
    sourceLocale: 'en',
    translation: 'تعذّر الوصول إلى الخادم',
    targetLocale: 'ar',
    state: 'confident',
    stateLabel: 'Suggested',
    origin: 'src/lib/api.ts',
    context: 'Shown when a request fails',
  },
];

/* ── Runs ──────────────────────────────────────────────────── */
export const SAMPLE_RUNS: SampleRun[] = [
  {
    id: 'run-8f2a',
    state: 'succeeded',
    trigger: 'localize-infra init',
    locales: 5,
    localesFailed: 0,
    strings: 128,
    durationMs: 22_400,
    prNumber: 142,
    prMerged: true,
    when: '2 hours ago',
  },
  {
    id: 'run-7c1b',
    state: 'partial',
    trigger: 'localize-infra init --open-pr',
    locales: 5,
    localesFailed: 1,
    strings: 128,
    durationMs: 31_900,
    prNumber: 141,
    when: 'yesterday',
  },
  {
    id: 'run-6a09',
    state: 'failed',
    trigger: 'localize-infra init',
    locales: 5,
    localesFailed: 5,
    strings: 0,
    durationMs: 1_800,
    when: '3 days ago',
  },
];

/* ── Locales ───────────────────────────────────────────────── */
export const SAMPLE_LOCALES: SampleLocale[] = [
  {
    code: 'de',
    translated: 128,
    total: 128,
    needsReview: 0,
    lastRun: '2 hours ago',
    state: 'confident',
  },
  {
    code: 'ja',
    translated: 127,
    total: 128,
    needsReview: 1,
    lastRun: '2 hours ago',
    state: 'ambiguous',
  },
  {
    code: 'es',
    translated: 128,
    total: 128,
    needsReview: 0,
    lastRun: '2 hours ago',
    state: 'confident',
  },
  {
    code: 'pt-BR',
    translated: 126,
    total: 128,
    needsReview: 1,
    lastRun: '2 hours ago',
    state: 'ambiguous',
  },
  {
    code: 'ar',
    translated: 96,
    total: 128,
    needsReview: 0,
    lastRun: 'yesterday',
    state: 'degraded',
  },
];

/* ── Run detail ────────────────────────────────────────────────
   A run is a traversal of the pipeline, so the detail view is the
   pipeline with per-stage outcomes. The stages are the real ones the
   CLI performs, in the order it performs them.
   ───────────────────────────────────────────────────────────── */
export type StageState = 'done' | 'partial' | 'failed' | 'skipped';

export interface SampleRunStage {
  name: string;
  state: StageState;
  /** The metric this stage produced, or why it did not run. */
  detail: string;
}

export interface SampleLocaleResult {
  code: string;
  state: 'translated' | 'escalated' | 'failed';
  strings: number;
  escalated: number;
  /** Verbatim provider or API message. Never paraphrased — it is what you search for. */
  error?: string;
}

export interface SampleRunDetail extends SampleRun {
  branch: string;
  commit: string;
  stages: SampleRunStage[];
  localeResults: SampleLocaleResult[];
}

const SUCCEEDED_STAGES: SampleRunStage[] = [
  { name: 'Detect', state: 'done', detail: 'Vite + React' },
  { name: 'Extract', state: 'done', detail: '128 strings' },
  { name: 'Translate', state: 'done', detail: '5 locales' },
  { name: 'Escalate', state: 'done', detail: 'Nothing ambiguous' },
  { name: 'Pull request', state: 'done', detail: '#142 merged' },
];

export const SAMPLE_RUN_DETAILS: Record<string, SampleRunDetail | undefined> = {
  'run-8f2a': {
    ...(SAMPLE_RUNS[0] as SampleRun),
    branch: 'localize/add-translations',
    commit: '4f9c2ab',
    stages: SUCCEEDED_STAGES,
    localeResults: [
      { code: 'de', state: 'translated', strings: 128, escalated: 0 },
      { code: 'ja', state: 'translated', strings: 128, escalated: 0 },
      { code: 'es', state: 'translated', strings: 128, escalated: 0 },
      { code: 'pt-BR', state: 'translated', strings: 128, escalated: 0 },
      { code: 'ar', state: 'translated', strings: 128, escalated: 0 },
    ],
  },
  'run-7c1b': {
    ...(SAMPLE_RUNS[1] as SampleRun),
    branch: 'localize/add-translations',
    commit: '2b7e10d',
    stages: [
      { name: 'Detect', state: 'done', detail: 'Vite + React' },
      { name: 'Extract', state: 'done', detail: '128 strings' },
      { name: 'Translate', state: 'partial', detail: '4 of 5 locales' },
      { name: 'Escalate', state: 'done', detail: '1 needs a decision' },
      { name: 'Pull request', state: 'done', detail: '#141 open' },
    ],
    localeResults: [
      { code: 'de', state: 'translated', strings: 128, escalated: 0 },
      { code: 'ja', state: 'escalated', strings: 127, escalated: 1 },
      { code: 'es', state: 'translated', strings: 128, escalated: 0 },
      { code: 'pt-BR', state: 'translated', strings: 128, escalated: 0 },
      {
        code: 'ar',
        state: 'failed',
        strings: 0,
        escalated: 0,
        error: 'Anthropic response had no text content block',
      },
    ],
  },
  'run-6a09': {
    ...(SAMPLE_RUNS[2] as SampleRun),
    branch: 'localize/add-translations',
    commit: '9d4a77c',
    stages: [
      { name: 'Detect', state: 'done', detail: 'Vite + React' },
      { name: 'Extract', state: 'done', detail: '128 strings' },
      { name: 'Translate', state: 'failed', detail: 'All 5 locales failed' },
      // A stage that never ran says so, rather than showing an empty success.
      { name: 'Escalate', state: 'skipped', detail: 'Nothing to escalate' },
      {
        name: 'Pull request',
        state: 'skipped',
        detail: 'Nothing to open one with',
      },
    ],
    localeResults: (['de', 'ja', 'es', 'pt-BR', 'ar'] as const).map((code) => ({
      code,
      state: 'failed' as const,
      strings: 0,
      escalated: 0,
      error: 'fetch failed — ECONNREFUSED 127.0.0.1:8787',
    })),
  },
};

export const SAMPLE_SOURCE_STRINGS = 128;
