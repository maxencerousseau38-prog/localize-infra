import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Moving a lead one step, when the step is the one it is standing on.
 *
 * Until now nothing advanced a lead at all. Discovery opened one at
 * `discovered` and it stayed there through research, drafting, approval and
 * sending — so `closer_stage_transitions` described a funnel that existed only
 * in the table. It was found by building the reply screen on top of it: a reply
 * is `contacted → replied`, and no lead was ever at `contacted`.
 *
 * The fix is not a new concept. Each action that already performs one of the
 * events the transition table names now says so, using the table's own words as
 * the reason. `closer_set_stage` still refuses any edge the table does not
 * contain, so this cannot invent a path.
 *
 * **Guarded on the current stage**, which is what makes it safe to call from an
 * action that runs twice. Research re-run on a qualified company would
 * otherwise send it back to `researching` — a legal edge, and exactly the wrong
 * one: rework is a decision, not a side effect of pressing a button again.
 */
export async function advanceLead(
  supabase: SupabaseClient,
  leadId: string,
  from: string,
  to: string,
  reason: string,
): Promise<'moved' | 'elsewhere' | 'failed'> {
  const { data: lead } = await supabase
    .from('closer_leads')
    .select('stage')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead || lead.stage !== from) return 'elsewhere';

  /*
   * No actor argument. `closer_set_stage` reads `auth.uid()` itself — the
   * parameter used to be caller-supplied and was reproduced attributing a
   * stage change to an account that was not even a member of the workspace.
   */
  const { error } = await supabase.rpc('closer_set_stage', {
    p_lead_id: leadId,
    p_to_stage: to,
    p_reason: reason,
  });

  /*
   * A failure here is reported, not thrown.
   *
   * The stage is a record of what happened, and the thing that happened —
   * the approval, the send, the reply — has already happened by the time this
   * runs. Losing the whole action because the funnel could not be updated would
   * discard the real event to protect the bookkeeping about it.
   */
  return error ? 'failed' : 'moved';
}

/**
 * The lead behind a company, if discovery opened one.
 *
 * Every caller here has a company and needs the lead; none of them should have
 * to remember that the relationship is one-to-one per workspace.
 */
export async function leadForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ id: string; stage: string } | null> {
  const { data } = await supabase
    .from('closer_leads')
    .select('id, stage')
    .eq('company_id', companyId)
    .maybeSingle();
  return data ?? null;
}
