import type { AnthropicSettings } from '../src/router/anthropic.js';

/**
 * The configurations being compared, and why each is in the list.
 *
 * All three run the **production** prompt, parser and batching — only the
 * provider settings differ, and those come from the same
 * `createAnthropicProvider` production calls. The point of the benchmark is to
 * choose a default, so measuring anything other than what would ship would
 * settle nothing.
 */
export interface EvalConfig {
  id: string;
  label: string;
  modelId: string;
  settings: Omit<AnthropicSettings, 'onUsage'>;
  /** Published US dollars per million tokens. */
  rate: { input: number; output: number };
  note: string;
}

/** Anthropic list prices, model table dated 2026-06-24. */
const SONNET_5 = { input: 3.0, output: 15.0 };
const HAIKU_4_5 = { input: 1.0, output: 5.0 };

export const CONFIGS: readonly EvalConfig[] = [
  {
    id: 'sonnet5-effort-low',
    label: 'Sonnet 5, effort: low',
    modelId: 'claude-sonnet-5',
    settings: { maxTokens: 8192, effort: 'low' },
    rate: SONNET_5,
    note: 'The proposed default. Exactly what createAnthropicProvider sends with no settings.',
  },
  {
    id: 'sonnet5-default-reasoning',
    label: 'Sonnet 5, default reasoning',
    modelId: 'claude-sonnet-5',
    settings: { maxTokens: 8192, effort: null },
    rate: SONNET_5,
    /*
     * The previous configuration, with one change that cannot be avoided: the
     * ceiling is 8192 rather than 4096.
     *
     * At 4096 this configuration returns **no text at all** on a batch of this
     * size — the whole budget goes on thinking. There is no quality to measure
     * in an empty response, so comparing it as-was would compare a working
     * configuration against a broken one and prove only what is already known.
     * Raising the ceiling isolates the variable actually in question: whether
     * the model's default reasoning translates better than `effort: low`.
     */
    note: 'The previous reasoning configuration. Ceiling raised to 8192 because at 4096 it returns nothing, so there would be no quality to measure.',
  },
  {
    id: 'haiku45',
    label: 'Haiku 4.5, thinking disabled',
    modelId: 'claude-haiku-4-5',
    // `effort` is rejected outright by Haiku 4.5 rather than ignored, so it is
    // omitted rather than set. Thinking is disabled explicitly for the same
    // reason it is tuned on Sonnet: it is billed as output.
    settings: { maxTokens: 8192, effort: null, thinking: 'disabled' },
    rate: HAIKU_4_5,
    note: 'The cheap-model option 08-critique.md §C3 called load-bearing. Included to price the quality it costs, not to adopt.',
  },
] as const;
