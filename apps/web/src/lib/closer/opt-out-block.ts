/**
 * Which messages an opt-out has overtaken.
 *
 * Extracted from the approvals page rather than written inline, because it is
 * the rule that decides whether a person is offered text to send to somebody
 * who asked to be left alone — and a rule that important should be checkable
 * without rendering a page.
 *
 * Deliberately not `server-only`: it reads plain values and touches no client.
 * The page passes it what it already fetched.
 *
 * Three signals rather than one, and the redundancy is the point:
 *
 *   - the lead sitting at `do_not_contact`, which is what `closer_suppress`
 *     writes and therefore the usual signal;
 *   - the company's domain on the suppression list;
 *   - the contact's address on it.
 *
 * The stage alone would be nearly enough — suppression moves the lead — but
 * "nearly" is doing a lot of work in a sentence about consent. A suppression
 * row whose lead somehow failed to move is exactly the case the stage check
 * cannot see, and it is the case this repository has already had once.
 */

export interface OptOutInputs {
  leadStage: string | null;
  companyDomain: string | null;
  contactEmail: string | null;
}

export interface Suppressions {
  domains: ReadonlySet<string>;
  emails: ReadonlySet<string>;
}

/** Why a message is blocked, in words for the operator, or null if it is not. */
export function optOutReason(
  inputs: OptOutInputs,
  suppressions: Suppressions,
): string | null {
  if (inputs.leadStage === 'do_not_contact') {
    return 'This lead is marked do-not-contact.';
  }

  const domain = inputs.companyDomain?.toLowerCase();
  if (domain && suppressions.domains.has(domain)) {
    return `The domain ${domain} is on the suppression list.`;
  }

  const email = inputs.contactEmail?.toLowerCase();
  if (email && suppressions.emails.has(email)) {
    return `The address ${email} is on the suppression list.`;
  }

  return null;
}

/** Build the lookup sets from the rows a query returned. */
export function suppressionSets(
  rows: readonly { domain: string | null; email: string | null }[],
): Suppressions {
  const domains = new Set<string>();
  const emails = new Set<string>();
  for (const row of rows) {
    if (row.domain) domains.add(row.domain.toLowerCase());
    if (row.email) emails.add(row.email.toLowerCase());
  }
  return { domains, emails };
}
