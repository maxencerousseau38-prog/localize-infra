-- Closer — an approved message must not survive an opt-out that arrives after it.
--
-- `closer_mark_message_sent` checked the message's state and nothing else. So a
-- message approved at 10:00, followed by an opt-out at 10:05, could still be
-- recorded as sent at 10:10 — and, worse, went on being offered on
-- `/closer/approvals` under "Approved, not yet sent" with no warning at all.
--
-- Every other guard in this system is defence in depth. This one was missing at
-- the single point where a contact can actually happen: nothing here sends, so
-- the human copying the text out is the only real send, and this is the screen
-- they copy it from. The guard was absent exactly where it mattered most.
--
-- Found by a read-only audit, by asking which functions reference
-- `do_not_contact` and noticing which ones on the contact path did not.
--
-- The two checks added are the same two `closer_approve_message` already
-- performs, and in the same order. Approval and recording a send are the two
-- moments a person acts on a message; there is no reason for them to disagree
-- about what stops them.
--
-- **What this deliberately does not change:** a message already in `sent`.
-- Those rows are untouched, keep their `sent_by` and `sent_at`, and replies
-- against them still record — a contact that really happened before the opt-out
-- is a fact, and a system that erased it would be lying about its own history
-- in the direction that flatters it.
--
-- The cost, stated because it is real: a send that genuinely happened before
-- the opt-out but was never recorded can no longer be recorded through this
-- function. The alternative was a way to backdate a send, which is a new
-- capability and a much easier thing to misuse than the gap it would close.

create or replace function public.closer_mark_message_sent(p_message_id uuid)
returns public.closer_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  message public.closer_messages;
  lead public.closer_leads;
  company public.closer_companies;
  contact public.closer_contacts;
  result public.closer_messages;
begin
  select * into message from public.closer_messages where id = p_message_id;
  if message is null then
    raise exception 'no such message' using errcode = 'P0002';
  end if;
  if not public.is_org_member(message.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'only a signed-in person can record a send' using errcode = '42501';
  end if;
  if message.state <> 'approved' then
    raise exception 'only an approved message can be recorded as sent (state: %)', message.state
      using errcode = '22023';
  end if;

  /*
   * Re-checked here, not only at approval.
   *
   * An approval is a decision about a moment. Between that moment and this one
   * an opt-out can arrive, and when it does the approval is stale rather than
   * wrong. Reading the lead and the suppression list again is what makes the
   * difference visible instead of silently irrelevant.
   */
  select * into lead from public.closer_leads where id = message.lead_id;
  select * into company from public.closer_companies where id = lead.company_id;
  select * into contact from public.closer_contacts where id = message.contact_id;

  if lead.stage = 'do_not_contact' then
    raise exception 'this lead is marked do_not_contact; the approval predates the opt-out'
      using errcode = '42501';
  end if;

  if public.closer_is_suppressed(message.organization_id, company.domain, contact.email) then
    raise exception 'this company or address is suppressed; the approval predates the opt-out'
      using errcode = '42501';
  end if;

  update public.closer_messages
     set state = 'sent',
         sent_by = auth.uid(),
         sent_at = now()
   where id = p_message_id
  returning * into result;

  return result;
end;
$$;
