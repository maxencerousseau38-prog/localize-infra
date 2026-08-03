import {
  type TranslatableString,
  TranslateBatchRequestSchema,
  type TranslateBatchResponse,
  TranslateBatchResponseSchema,
} from '@localize-infra/schemas';

export async function translateBatch(
  apiUrl: string,
  targetLocale: string,
  strings: TranslatableString[],
  apiToken: string,
): Promise<TranslateBatchResponse> {
  const request = TranslateBatchRequestSchema.parse({ targetLocale, strings });
  const response = await fetch(`${apiUrl}/v1/translate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Translation API request failed (${response.status}): ${errorBody}`,
    );
  }
  const json: unknown = await response.json();
  return TranslateBatchResponseSchema.parse(json);
}
