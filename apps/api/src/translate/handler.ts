import type {
  ChunkFailure,
  TranslatableString,
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranslatedString,
} from '@localize-infra/schemas';
import type { Provider } from '../router/types.js';
import { parseTranslationResponse } from './parse-response.js';
import { buildBatchPrompt } from './prompt.js';

/**
 * How many strings go in one request.
 *
 * Measured, not chosen. `docs/product/10-model-benchmark.md` records real calls
 * against the configured model using this repository's own prompt and corpus:
 * a 100-string chunk at `effort: low` emits 5,603 output tokens against an
 * 8,192 ceiling, and 414 strings across five locales came back complete.
 *
 * 100 is deliberately below what fits rather than at it. A batch with an
 * unusual number of escalations emits a question and alternatives for each,
 * which is roughly 3.7x the tokens of a confident one, and the headroom is what
 * absorbs that instead of losing the chunk.
 */
export const MAX_STRINGS_PER_REQUEST = 100;

/**
 * Three attempts, and the third is nearly free because it rarely happens.
 *
 * The benchmark's failure rates say what this is for: at `effort: low` the
 * configured model returned parseable output in 11 of 11 requests, so the
 * retry is insurance against a tail rather than a crutch. Haiku failed 2 of 6
 * on the same input — a single retry recovers that shape, and a second covers
 * the case where the retry is unlucky too.
 *
 * Bounded deliberately: a model that reliably cannot answer a chunk will not
 * start on the fourth try, and an unbounded retry against a rate limit is how
 * one slow run becomes an outage.
 */
export const MAX_ATTEMPTS = 3;

/** First backoff, doubling per attempt. */
const BASE_BACKOFF_MS = 500;

export interface TranslateOptions {
  /** Attempts per chunk, including the first. Defaults to `MAX_ATTEMPTS`. */
  maxAttempts?: number;
  /** Injected so tests do not wait. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected so the jitter is reproducible in tests. Defaults to Math.random. */
  random?: () => number;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential, with jitter.
 *
 * The jitter is not decoration. Chunks run in sequence here, but locales do
 * not: `run-actions.ts` translates each locale in turn and several runs can be
 * in flight at once, so a fixed backoff makes everything that failed together
 * come back together — which is the shape that earns a second rate limit.
 *
 * Full jitter (a uniform draw over the whole window) rather than a small
 * wobble, because it is the variant that actually spreads a thundering herd.
 */
export function backoffMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  const ceiling = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * One chunk, retried until it is answered or the attempts run out.
 *
 * Returns what it managed to get plus, if anything was lost to a fault, the
 * reason. Two properties matter more than the retry itself:
 *
 *   - **A key is accepted once.** Attempt two asks only for what is still
 *     missing, so there is no second answer to reconcile. A model that answers
 *     half a chunk and then all of it on retry cannot produce two translations
 *     for one key — the retry never asks about the accepted half.
 *   - **A key nobody asked for is dropped.** `parseTranslationResponse`
 *     validates shape, not membership, so a hallucinated key would otherwise
 *     reach `record_run_translations` as a proposal for a string that does not
 *     exist in the repository.
 */
async function translateChunk(
  strings: TranslatableString[],
  request: TranslateBatchRequest,
  provider: Provider,
  modelId: string,
  options: Required<Pick<TranslateOptions, 'maxAttempts' | 'sleep' | 'random'>>,
): Promise<{ translations: TranslatedString[]; failure: ChunkFailure | null }> {
  const requested = new Set(strings.map((s) => s.key));
  const accepted = new Map<string, TranslatedString>();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const pending = strings.filter((s) => !accepted.has(s.key));
    if (pending.length === 0) break;

    let threw = false;
    try {
      const raw = await provider.translate(
        buildBatchPrompt({ ...request, strings: pending }),
        modelId,
      );
      for (const translation of parseTranslationResponse(raw)) {
        if (!requested.has(translation.key)) continue;
        if (accepted.has(translation.key)) continue;
        accepted.set(translation.key, translation);
      }
      lastError = null;
    } catch (error) {
      threw = true;
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    const stillPending = strings.some((s) => !accepted.has(s.key));
    if (!stillPending || attempt === options.maxAttempts) break;

    /*
     * Backoff only after a thrown attempt.
     *
     * A partial answer is retried too — a model asked for a hundred keys and
     * returning five has failed the request, and the next attempt asks only
     * about the gap, so it costs a fraction of the first. But the model was
     * responsive, which is the opposite of the signal a backoff exists for.
     * Waiting here would add latency to the common small case for no reason.
     */
    if (threw) await options.sleep(backoffMs(attempt, options.random));
  }

  const translations = strings
    .map((s) => accepted.get(s.key))
    .filter((t): t is TranslatedString => t !== undefined);

  // A failure record only when work was lost to a fault. A model that answered
  // and omitted a key leaves a missing key and no failure — see above.
  const failure: ChunkFailure | null = lastError
    ? {
        keys: strings.filter((s) => !accepted.has(s.key)).map((s) => s.key),
        attempts: options.maxAttempts,
        error: lastError.message,
      }
    : null;

  return { translations, failure };
}

/**
 * Translates a batch, in as many requests as it takes.
 *
 * This was one request for however many strings the caller sent, and neither
 * the CLI nor apps/web chunked, so the size of a request was the size of the
 * customer's repository. That worked for the fixture on the landing page and
 * for nothing else.
 *
 * Chunks run **sequentially**, which is a deliberate choice against latency. A
 * customer's whole locale arriving at a provider at once is the shape that
 * earns a 429, and with retries in play a burst is worse than it was.
 *
 * A failing chunk does not fail the batch: a batch can be genuinely partial,
 * and the honest answer is the translations that exist, the keys that do not,
 * and why. A batch where **every** chunk failed still throws, because answering
 * 200 with an empty array would make a provider outage indistinguishable from a
 * model that returned nothing — and the route's 502 depends on the error
 * reaching it.
 */
export async function handleTranslateBatch(
  request: TranslateBatchRequest,
  provider: Provider,
  modelId: string,
  options: TranslateOptions = {},
): Promise<TranslateBatchResponse> {
  const resolved = {
    maxAttempts: options.maxAttempts ?? MAX_ATTEMPTS,
    sleep: options.sleep ?? realSleep,
    random: options.random ?? Math.random,
  };

  const translations: TranslatedString[] = [];
  const failures: ChunkFailure[] = [];
  let lastError: string | null = null;

  for (const strings of chunk(request.strings, MAX_STRINGS_PER_REQUEST)) {
    const result = await translateChunk(
      strings,
      request,
      provider,
      modelId,
      resolved,
    );
    translations.push(...result.translations);
    if (result.failure) {
      failures.push(result.failure);
      lastError = result.failure.error;
    }
  }

  if (lastError !== null && translations.length === 0) {
    throw new Error(lastError);
  }

  const foundKeys = new Set(translations.map((t) => t.key));
  const missingKeys = request.strings
    .filter((s) => !foundKeys.has(s.key))
    .map((s) => s.key);

  return { translations, missingKeys, failures };
}
