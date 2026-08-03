import {
  type OpenPrApiRequest,
  OpenPrApiRequestSchema,
  type OpenPrApiResponse,
  OpenPrApiResponseSchema,
} from '@localize-infra/schemas';

export async function requestPr(
  apiUrl: string,
  request: OpenPrApiRequest,
): Promise<OpenPrApiResponse> {
  const body = OpenPrApiRequestSchema.parse(request);
  const response = await fetch(`${apiUrl}/v1/open-pr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Open-PR API request failed (${response.status}): ${errorBody}`,
    );
  }
  const json: unknown = await response.json();
  return OpenPrApiResponseSchema.parse(json);
}
