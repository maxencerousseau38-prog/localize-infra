'use server';

import { closerOrganizationId } from '@/lib/closer/access';
import { classifyReply } from '@/lib/closer/classification';
import { advanceLead } from '@/lib/closer/funnel';
import { requireSession } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import {
  type ReplyIntent,
  detectOptOut,
  suggestedStage,
} from '@localize-infra/closer-core';
import { revalidatePath } from 'next/cache';

/**
 * Recording a reply, reading it, and acting on what it says.
 *
 * The order of the first two is the design. Opt-out is detected without a model
 * at the moment the text arrives, and the suppression it triggers happens
 * before anything is classified — so a classifier that is slow, wrong, or
 * unavailable cannot delay somebody being left alone.
 */

export interface RecordReplyState {
  error?: string;
  done?: { optedOut: boolean; phrase?: string };
}

export interface ClassifyState {
  error?: string;
  done?: { intent: ReplyIntent; confidence: number };
}

export interface ConfirmState {
  error?: string;
  done?: string;
}

export async function recordReply(
  _previous: RecordReplyState,
  form: FormData,
): Promise<RecordReplyState> {
  await requireSession();
  const organizationId = await closerOrganizationId();
  if (!organizationId)
    return { error: 'Closer is not enabled for this workspace' };

  const messageId = String(form.get('messageId') ?? '');
  const body = String(form.get('body') ?? '').trim();
  if (!messageId) return { error: 'No message was named' };
  if (!body) return { error: 'Paste what they wrote' };

  const supabase = await createClient();

  /*
   * Detected before the row is written, so the phrase is stored with it.
   *
   * A suppression traced back to a stored phrase can be explained by showing
   * somebody the sentence. One traced only to a classification can be explained
   * by pointing at a model, which is not an explanation.
   */
  const optOut = detectOptOut(body);

  const { data: reply, error } = await supabase.rpc('closer_record_reply', {
    p_message_id: messageId,
    p_body: body,
    p_received_at: new Date().toISOString(),
    p_opt_out_phrase: optOut?.phrase ?? null,
    p_opt_out_excerpt: optOut?.excerpt ?? null,
  });
  if (error) return { error: error.message };

  // "They answered" — the transition table's note, and the event just happened.
  await advanceLead(
    supabase,
    reply.lead_id,
    'contacted',
    'replied',
    'They answered',
  );

  if (optOut) {
    /*
     * Suppressed immediately, on the words alone.
     *
     * Not queued behind a confirmation and not waiting for a classification:
     * this is the one decision where acting without a person is safer than
     * asking one, because the cost of being early is a company nobody writes
     * to again and the cost of being late is writing to somebody who asked not
     * to be.
     */
    const { data: contact } = await supabase
      .from('closer_contacts')
      .select('email, company_id')
      .eq('id', reply.contact_id)
      .maybeSingle();
    const { data: company } = await supabase
      .from('closer_companies')
      .select('domain')
      .eq('id', contact?.company_id ?? '')
      .maybeSingle();

    /*
     * Two rows, not one — `closer_suppressions_one_identifier` requires each
     * row to carry exactly one of domain or email.
     *
     * Found by probing: passing both raised a check-constraint violation, and
     * the probe's other assertion then "passed" for an unrelated reason, so the
     * opt-out path looked verified when nothing had been suppressed at all.
     *
     * Both are written when both are known, and suppressing the domain as well
     * as the address is the deliberate choice: one person at a company saying
     * "take me off your list" is not an invitation to write to their colleague
     * next week. It is also what the screen tells the reader has happened.
     */
    const note = optOut.excerpt.slice(0, 500);
    for (const identifier of [
      { domain: company?.domain ?? null, email: null },
      { domain: null, email: contact?.email ?? null },
    ]) {
      if (!identifier.domain && !identifier.email) continue;
      await supabase.rpc('closer_suppress', {
        p_organization_id: organizationId,
        p_domain: identifier.domain,
        p_email: identifier.email,
        p_reason: 'opted_out',
        p_note: note,
      });
    }
  }

  revalidatePath('/closer/replies');
  revalidatePath('/closer');
  return { done: { optedOut: Boolean(optOut), phrase: optOut?.phrase } };
}

export async function classifyReplyAction(
  _previous: ClassifyState,
  form: FormData,
): Promise<ClassifyState> {
  await requireSession();
  const organizationId = await closerOrganizationId();
  if (!organizationId)
    return { error: 'Closer is not enabled for this workspace' };

  const replyId = String(form.get('replyId') ?? '');
  if (!replyId) return { error: 'No reply was named' };

  try {
    const result = await classifyReply(organizationId, replyId);
    revalidatePath('/closer/replies');
    return { done: { intent: result.intent, confidence: result.confidence } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * A person says what the reply meant, and the lead moves if they ask it to.
 *
 * Two steps in one submission because they are one decision, but the stage move
 * is opt-in: the form carries the stage the operator chose from the moves the
 * database says are legal, and an empty value means "record what it meant,
 * leave the funnel alone". An intent is not always a stage change — a question
 * is a reply, not a promotion.
 */
export async function confirmReplyIntent(
  _previous: ConfirmState,
  form: FormData,
): Promise<ConfirmState> {
  await requireSession();
  const supabase = await createClient();

  const replyId = String(form.get('replyId') ?? '');
  const intent = String(form.get('intent') ?? '') as ReplyIntent;
  const moveTo = String(form.get('moveTo') ?? '').trim();
  if (!replyId || !intent) return { error: 'Nothing was chosen' };

  const { data: reply, error } = await supabase.rpc(
    'closer_confirm_reply_intent',
    { p_reply_id: replyId, p_intent: intent },
  );
  if (error) return { error: error.message };

  if (!moveTo) {
    revalidatePath('/closer/replies');
    return { done: 'Recorded.' };
  }

  const { data: lead } = await supabase
    .from('closer_leads')
    .select('stage')
    .eq('id', reply.lead_id)
    .maybeSingle();

  const { error: stageError } = await supabase.rpc('closer_set_stage', {
    p_lead_id: reply.lead_id,
    p_to_stage: moveTo,
    p_reason: `Reply read as ${intent}`,
  });

  revalidatePath('/closer/replies');
  revalidatePath('/closer');

  if (stageError) {
    return {
      error: `Recorded as ${intent}, but the lead did not move from ${lead?.stage ?? 'its stage'}: ${stageError.message}`,
    };
  }

  const suggested = suggestedStage(intent);
  return {
    done:
      moveTo === suggested
        ? `Recorded, and moved to ${moveTo}.`
        : `Recorded as ${intent}, and moved to ${moveTo}.`,
  };
}
