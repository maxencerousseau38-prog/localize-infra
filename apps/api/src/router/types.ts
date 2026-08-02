export interface TranslateRequest {
  systemPrompt: string
  userPrompt: string
}

export interface Provider {
  name: 'anthropic' | 'openai'
  translate(req: TranslateRequest, modelId: string): Promise<string>
}
