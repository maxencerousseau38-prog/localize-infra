import type { Provider, TranslateRequest } from './types.js'

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
          max_tokens: 4096,
          system: req.systemPrompt,
          messages: [{ role: 'user', content: req.userPrompt }],
        }),
      })
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { content: { type: string; text: string }[] }
      const textBlock = body.content.find((block) => block.type === 'text')
      if (!textBlock || !textBlock.text.trim()) {
        throw new Error('Anthropic response had no usable text content block')
      }
      return textBlock.text.trim()
    },
  }
}
