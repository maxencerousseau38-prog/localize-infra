import {
  type OpenPrApiRequest,
  OpenPrApiRequestSchema,
  type OpenPrApiResponse,
  OpenPrApiResponseSchema,
} from '@localize-infra/schemas';

/**
 * What asking for a pull request produced.
 *
 * Discriminated rather than nullable: "opened" and "there was nothing to open"
 * are two outcomes, and a caller that forgets the second gets a type error
 * instead of a URL that is `undefined`.
 */
export type PrOutcome =
  | { opened: true; pr: OpenPrApiResponse }
  | { opened: false };

export async function requestPr(
  apiUrl: string,
  request: OpenPrApiRequest,
  apiToken: string,
): Promise<PrOutcome> {
  const body = OpenPrApiRequestSchema.parse(request);
  const response = await fetch(`${apiUrl}/v1/open-pr`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });
  /*
   * 409 is the API saying the request changes nothing — every file in it is
   * already on the base branch. That is an outcome, not a fault: throwing here
   * would report "the run failed" for a repository that is simply up to date.
   *
   * Read before the generic `!response.ok`, which would otherwise swallow it
   * into the same error every real failure produces.
   */
  if (response.status === 409) {
    return { opened: false };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Open-PR API request failed (${response.status}): ${errorBody}`,
    );
  }
  const json: unknown = await response.json();
  return { opened: true, pr: OpenPrApiResponseSchema.parse(json) };
}
