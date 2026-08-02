import type { Provider, TranslateRequest } from './types.js'

export function createOpenAiProvider(apiKey: string, baseUrl = 'https://api.openai.com/v1'): Provider {
  return {
    name: 'openai',
    async translate(req: TranslateRequest, modelId: string): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userPrompt },
          ],
        }),
      })
      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { choices: { message: { content: string } }[] }
      const content = body.choices[0]?.message.content
      if (!content) throw new Error('OpenAI response had no message content')
      return content.trim()
    },
  }
}
