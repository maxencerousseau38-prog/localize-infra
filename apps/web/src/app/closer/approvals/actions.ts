'use server';

import { advanceLead } from '@/lib/closer/funnel';
import { requireSession } from '@/lib/data/workspace';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * What a reviewer can do to a draft.
 *
 * Four actions, each a single RPC. The checks that matter — that a person is
 * signed in, that the address is not suppressed, that the workspace has not
 * already written to this company this fortnight — are in the database, not
 * here. This file exists to turn a form submission into a call and an error
 * into a sentence.
 *
 * There is deliberately no `send`. Nothing in this repository can send an
 * email, so the only honest action is to record that a person sent one.
 */

export interface ReviewState {
  error?: string;
  done?: string;
}

async function withSupabase() {
  await requireSession();
  return createClient();
}

/**
 * The lead behind a message, so the funnel can follow what just happened.
 *
 * Read after the action rather than before, because the action is the event
 * and its success is what justifies the move.
 */
async function leadOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('closer_messages')
    .select('lead_id')
    .eq('id', messageId)
    .maybeSingle();
  return data?.lead_id ?? null;
}

/**
 * Errors from Postgres, in words a reviewer can act on.
 *
 * The RPCs raise with a message written for this screen, so most pass through
 * unchanged. What is added is the one case where the raw message would mislead:
 * a `54000` is a limit doing its job, not a fault, and reading "error" beside it
 * would send somebody looking for a bug.
 */
function explain(error: { message: string; code?: string }): string {
  if (error.code === '54000') return `Held back — ${error.message}`;
  return error.message;
}

export async function approveMessage(
  _previous: ReviewState,
  form: FormData,
): Promise<ReviewState> {
  const id = String(form.get('messageId') ?? '');
  if (!id) return { error: 'No message was named' };

  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc('closer_approve_message', {
    p_message_id: id,
  });
  if (error) return { error: explain(error) };

  // "A human approved the draft" — the transition table's own note for this
  // edge, and the only event that satisfies it just happened.
  const leadId = await leadOf(supabase, id);
  if (leadId) {
    await advanceLead(
      supabase,
      leadId,
      'ready_for_outreach',
      'outreach_approved',
      'A human approved the draft',
      session.userId,
    );
  }

  revalidatePath('/closer/approvals');
  return {
    done: 'Approved. Copy it and send it yourself — see the note below.',
  };
}

export async function rejectMessage(
  _previous: ReviewState,
  form: FormData,
): Promise<ReviewState> {
  const id = String(form.get('messageId') ?? '');
  const reason = String(form.get('reason') ?? '').trim();
  if (!id) return { error: 'No message was named' };

  /*
   * The reason is required here as well as in the database.
   *
   * Not redundancy: the database refusing a null gives the reviewer a Postgres
   * error where a sentence belongs, and the reason is the only feedback this
   * system ever receives about what a bad draft looked like.
   */
  if (!reason)
    return {
      error:
        'Say why, in a few words — it is the only feedback the drafting gets',
    };

  const supabase = await withSupabase();
  const { error } = await supabase.rpc('closer_reject_message', {
    p_message_id: id,
    p_reason: reason,
  });
  if (error) return { error: explain(error) };

  revalidatePath('/closer/approvals');
  return { done: 'Rejected.' };
}

export async function reviseMessage(
  _previous: ReviewState,
  form: FormData,
): Promise<ReviewState> {
  const id = String(form.get('messageId') ?? '');
  const body = String(form.get('body') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  if (!id) return { error: 'No message was named' };
  if (!body) return { error: 'The message cannot be empty' };

  const supabase = await withSupabase();
  const { error } = await supabase.rpc('closer_revise_message', {
    p_message_id: id,
    p_body: body,
    p_subject: subject || null,
  });
  if (error) return { error: explain(error) };

  revalidatePath('/closer/approvals');
  return { done: 'Saved. It is still awaiting approval.' };
}

/**
 * Record that a person sent it.
 *
 * Named for what it does. The button says "I sent this" rather than "Send",
 * because the difference between the two is the whole of what this system can
 * currently do.
 */
export async function markMessageSent(
  _previous: ReviewState,
  form: FormData,
): Promise<ReviewState> {
  const id = String(form.get('messageId') ?? '');
  if (!id) return { error: 'No message was named' };

  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc('closer_mark_message_sent', {
    p_message_id: id,
  });
  if (error) return { error: explain(error) };

  const leadId = await leadOf(supabase, id);
  if (leadId) {
    await advanceLead(
      supabase,
      leadId,
      'outreach_approved',
      'contacted',
      'The message left',
      session.userId,
    );
  }

  revalidatePath('/closer/approvals');
  revalidatePath('/closer/replies');
  return { done: 'Recorded as sent.' };
}
