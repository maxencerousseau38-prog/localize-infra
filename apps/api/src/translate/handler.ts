import type {
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
 * Measured, not chosen. `docs/product/09-unit-economics.md` records real calls
 * against the configured model using this repository's own prompt and corpus:
 *
 *   | strings | stop_reason  | thinking | output | usable |
 *   |--------:|--------------|---------:|-------:|--------|
 *   |      20 | end_turn     |    1,799 |  3,186 | 20 of 20 |
 *   |      40 | max_tokens   |    4,096 |  4,096 | **none** |
 *   |     100 | end_turn     |       85 |  5,603 | 100 of 100 (at effort: low) |
 *
 * The middle row is why this constant exists. `claude-sonnet-5` runs adaptive
 * thinking by default and thinking is billed as output, so a large batch spent
 * the entire budget reasoning and returned an empty content block — not a
 * truncated answer, no answer. The bottom row is why 100 is safe rather than
 * 20: `effort: low` collapses the thinking and leaves the ceiling to the text.
 *
 * 100 is deliberately below what fits (5,603 of 8,192) rather than at it. A
 * batch with an unusual number of escalations emits question and alternatives
 * for each, which is roughly 3.7x the tokens of a confident one, and the
 * headroom is what absorbs that instead of losing the chunk.
 */
export const MAX_STRINGS_PER_REQUEST = 100;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Translates a batch, in as many requests as it takes.
 *
 * This used to be one request for however many strings the caller sent, and
 * neither the CLI nor apps/web chunked, so the size of a request was the size
 * of the customer's repository. That worked for the fixture on the landing page
 * and for nothing else.
 *
 * Chunks run **sequentially**, which is a deliberate choice against latency. A
 * customer's whole locale arriving at a provider at once is the shape that
 * earns a 429, and a rate-limited chunk is a lost chunk — there is no retry
 * here. Sequential also keeps the failure mode legible: chunk N failing does
 * not leave chunks N+1..M in flight with nothing to receive them.
 *
 * A failing chunk does not fail the batch. Before chunking there was one
 * request and one outcome; now a batch can be genuinely partial, and the honest
 * answer is the translations that exist plus the keys that do not. Returning
 * fewer translations while reporting success is the failure mode that made
 * `missingKeys` necessary in the first place.
 */
export async function handleTranslateBatch(
  request: TranslateBatchRequest,
  provider: Provider,
  modelId: string,
): Promise<TranslateBatchResponse> {
  const translations: TranslatedString[] = [];
  let lastError: unknown = null;
  let failedChunks = 0;

  for (const strings of chunk(request.strings, MAX_STRINGS_PER_REQUEST)) {
    const prompt = buildBatchPrompt({ ...request, strings });
    try {
      const raw = await provider.translate(prompt, modelId);
      translations.push(...parseTranslationResponse(raw));
    } catch (error) {
      /*
       * Held, not swallowed.
       *
       * Every string in this chunk falls out as a missing key below, which is
       * what a caller with other chunks acts on. Rethrowing immediately would
       * discard the chunks that succeeded — on a large project that is
       * thousands of translations thrown away because one request was rate
       * limited.
       */
      failedChunks += 1;
      lastError = error;
    }
  }

  /*
   * A batch where nothing worked is a failure, not a partial success.
   *
   * Without this the route answers 200 with an empty array and every key
   * listed as missing, which is indistinguishable from a model that returned
   * nothing — so a provider outage would be reported to the customer as a
   * partial run rather than as the outage it is. The route's 502 contract
   * depends on the error reaching it.
   */
  if (failedChunks > 0 && translations.length === 0) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  const foundKeys = new Set(translations.map((t) => t.key));
  const missingKeys = request.strings
    .filter((s) => !foundKeys.has(s.key))
    .map((s) => s.key);

  return { translations, missingKeys };
}
