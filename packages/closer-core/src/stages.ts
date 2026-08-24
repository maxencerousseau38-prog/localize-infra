/**
 * The sales lifecycle, as the application needs to reason about it.
 *
 * **The allowed transitions are not here.** They live in
 * `public.closer_stage_transitions`, seeded by migration
 * `20260824000200_closer_transitions.sql`, and `closer_set_stage` is the only
 * writer of `stage`. Mirroring the edge list in TypeScript would create a
 * second authority that drifts from the first, and the drift would be silent:
 * the client would offer a move the database then refuses, or — worse — omit a
 * move that is legitimate, and nobody would notice because the funnel would
 * simply appear to have fewer doors.
 *
 * So the surfaces that need "what can this lead do next" ask the database. What
 * lives here is what the database cannot answer: the order stages appear in,
 * which of them mean the lead has stopped, and how to say them in English.
 * Those are presentation facts, and they belong on this side.
 *
 * The enum members mirror `public.closer_stage`. That mirroring cannot be
 * checked at unit-test time — the database is the authority and it rejects a
 * value it does not know, which is the real guard.
 */

export const CLOSER_STAGES = [
  'discovered',
  'researching',
  'qualified',
  'ready_for_outreach',
  'outreach_approved',
  'contacted',
  'replied',
  'interested',
  'qualified_opportunity',
  'meeting_requested',
  'meeting_booked',
  'trial',
  'negotiation',
  'won',
  'not_a_fit',
  'not_now',
  'unresponsive',
  'lost',
  'do_not_contact',
] as const;

export type CloserStage = (typeof CLOSER_STAGES)[number];

/**
 * Stages where the lead has stopped moving forward.
 *
 * `won` is deliberately **not** here. A won customer is not a lead that
 * stopped; it is the outcome the funnel exists to produce, and grouping it with
 * `lost` would make every funnel chart count success as an ending rather than
 * as the point.
 */
export const TERMINAL_STAGES = [
  'not_a_fit',
  'not_now',
  'unresponsive',
  'lost',
  'do_not_contact',
] as const;

export type TerminalStage = (typeof TERMINAL_STAGES)[number];

const TERMINAL = new Set<string>(TERMINAL_STAGES);

export function isTerminal(stage: CloserStage): stage is TerminalStage {
  return TERMINAL.has(stage);
}

/**
 * How far along the funnel a stage sits, for ordering a table by progress.
 *
 * Terminal stages return `null` rather than a large or a negative number.
 * Giving them a position would place them somewhere on the funnel, and a lead
 * that said "not now" is not further along than one being researched — it is
 * off the line entirely. Callers sorting by progress have to decide where to
 * put them, which is the decision that would otherwise be made by accident.
 */
export function funnelPosition(stage: CloserStage): number | null {
  if (isTerminal(stage)) return null;
  return CLOSER_STAGES.indexOf(stage);
}

/** The furthest stage `won` sits at, used to normalise progress to a fraction. */
const WON_POSITION = CLOSER_STAGES.indexOf('won');

/**
 * Progress through the funnel as a fraction, or null for a stage that has left
 * it. `won` is 1; `discovered` is 0.
 */
export function funnelProgress(stage: CloserStage): number | null {
  const position = funnelPosition(stage);
  return position === null ? null : position / WON_POSITION;
}

export interface StageLabel {
  /** Sentence case, for a badge or a column. */
  label: string;
  /** What the stage means, for a tooltip or an empty state. */
  meaning: string;
}

/**
 * Wording, in one place.
 *
 * The stage names are database identifiers and reading them raw in an
 * interface — `qualified_opportunity` — is the kind of leak that tells a user
 * they are looking at a table rather than at their pipeline.
 */
export const STAGE_LABELS: Record<CloserStage, StageLabel> = {
  discovered: {
    label: 'Discovered',
    meaning: 'Found by discovery; nothing has been researched yet',
  },
  researching: {
    label: 'Researching',
    meaning: 'Evidence is being gathered',
  },
  qualified: {
    label: 'Qualified',
    meaning: 'The evidence supports a fit',
  },
  ready_for_outreach: {
    label: 'Ready for outreach',
    meaning: 'A contact and an angle exist; a draft is waiting',
  },
  outreach_approved: {
    label: 'Approved',
    meaning: 'A person approved the message; it has not left yet',
  },
  contacted: {
    label: 'Contacted',
    meaning: 'The message was sent',
  },
  replied: {
    label: 'Replied',
    meaning: 'They answered; the answer has not been judged yet',
  },
  interested: {
    label: 'Interested',
    meaning: 'The answer was positive',
  },
  qualified_opportunity: {
    label: 'Opportunity',
    meaning: 'Need, timing or budget is confirmed',
  },
  meeting_requested: {
    label: 'Meeting requested',
    meaning: 'A time has been proposed',
  },
  meeting_booked: {
    label: 'Meeting booked',
    meaning: 'A time is in the calendar',
  },
  trial: {
    label: 'Trial',
    meaning: 'They are using the product',
  },
  negotiation: {
    label: 'Negotiation',
    meaning: 'Terms are being discussed',
  },
  won: {
    label: 'Won',
    meaning: 'They are a paying customer',
  },
  not_a_fit: {
    label: 'Not a fit',
    meaning: 'The evidence did not support a fit',
  },
  not_now: {
    label: 'Not now',
    meaning:
      'They asked to be approached later; the only terminal state that can re-enter',
  },
  unresponsive: {
    label: 'Unresponsive',
    meaning: 'Contacted, never answered, follow-up budget spent',
  },
  lost: {
    label: 'Lost',
    meaning: 'A real opportunity that did not close',
  },
  do_not_contact: {
    label: 'Do not contact',
    meaning: 'Suppressed. Absorbing — there is no way out of this state',
  },
};
