import type { Provider, TranslateRequest } from './types.js';

export function createAnthropicProvider(apiKey: string): Provider {
  return {
    name: 'anthropic',
    async translate(req: TranslateRequest, modelId: string): Promise<string> {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          /*
           * 8192, and the previous 4096 was not merely tight — it returned
           * nothing.
           *
           * `claude-sonnet-5` runs adaptive thinking by default and thinking
           * tokens are billed against this ceiling. Measured 2026-08-21 on
           * this repository's own prompt and corpus: at 40 strings the model
           * spent all 4096 tokens reasoning and emitted an empty content
           * block, so `translate` below threw and the run failed. Reproduced
           * at 80. A 100-string batch at the effort below needs 5,603.
           */
          max_tokens: 8192,
          /*
           * Batch translation is not a reasoning task, and paying for
           * reasoning here bought a failure rather than accuracy.
           *
           * Measured output per string: 159 tokens at the default effort
           * against 56 at `low` — 2.8x cheaper, and the difference between a
           * batch that answers and one that does not. Combined with the
           * ceiling above, a 100-string chunk is comfortable rather than
           * borderline.
           *
           * The quality of `low` against the default is **not** measured. The
           * eval harness in `packages/eval` is what settles that, and it has
           * not been run on this question — so this is the setting that makes
           * the product work, pending evidence that it does not cost accuracy.
           */
          output_config: { effort: 'low' },
          system: req.systemPrompt,
          messages: [{ role: 'user', content: req.userPrompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Anthropic API error ${response.status}: ${await response.text()}`,
        );
      }
      const body = (await response.json()) as {
        content: { type: string; text: string }[];
      };
      const textBlock = body.content.find((block) => block.type === 'text');
      if (!textBlock || !textBlock.text.trim()) {
        throw new Error('Anthropic response had no usable text content block');
      }
      return textBlock.text.trim();
    },
  };
}
