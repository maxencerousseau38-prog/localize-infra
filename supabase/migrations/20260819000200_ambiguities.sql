-- Ambiguities: the strings the agent refused to guess at.
--
-- Invariant 4 of this project is that the agent raises ambiguities rather than
-- guessing them. Until now that was a sentence in a document: the translation
-- contract had two fields, so a coin flip between two readings came back in
-- exactly the same shape as a certainty and shipped as one. The model can now
-- say "I am not sure, and here is what I need to know", and this is where that
-- answer is kept.
--
-- Still invariant 1: no translated string is *stored as the product* here. The
-- proposal and the alternatives are the question being asked, and they live in
-- the customer's repository the moment the question is answered.

create type public.ambiguity_state as enum (
  'unresolved',
  'resolved',
  'dismissed'
);

create table public.run_ambiguities (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Which string, in which language.
  translation_key text not null,
  locale text not null,
  source_text text not null,

  -- What the model proposed, and why it is asking. `question` is not null
  -- because an escalation nobody can answer is an interruption, not a
  -- question — the same rule the response schema enforces at the edge.
  proposed_text text not null,
  question text not null check (length(trim(question)) between 1 and 1000),

  -- [{ "text": "...", "rationale": "..." }]. JSONB rather than a child table:
  -- alternatives are read only with their ambiguity, never queried across
  -- them, and a table would buy joins nobody needs.
  alternatives jsonb not null default '[]'::jsonb
    check (jsonb_typeof(alternatives) = 'array'),

  state public.ambiguity_state not null default 'unresolved',

  -- The decision. Null until somebody makes one, and the pair is kept whole by
  -- a constraint below so "resolved" can never mean "resolved to nothing".
  resolved_text text,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),

  -- One question per key per locale per run. A model repeating itself within a
  -- batch must not produce the same question twice in the queue.
  unique (run_id, translation_key, locale)
);

-- A resolution is a decision plus its text, or neither.
alter table public.run_ambiguities
  add constraint run_ambiguities_resolution_is_whole
  check (
    (state = 'resolved' and resolved_text is not null and resolved_at is not null)
    or (state <> 'resolved' and resolved_text is null)
  );

create index run_ambiguities_run_idx
  on public.run_ambiguities (run_id, state);
create index run_ambiguities_project_state_idx
  on public.run_ambiguities (project_id, state, created_at desc);

alter table public.run_ambiguities enable row level security;

-- Reads follow membership, exactly like runs and projects.
create policy run_ambiguities_select_member on public.run_ambiguities
  for select to authenticated
  using (public.is_org_member(organization_id));

-- No client INSERT: an ambiguity is something the pipeline observed, and a row
-- a client can write is a claim rather than a record. Resolution goes through
-- resolve_ambiguity() below so the state machine cannot be sidestepped.

create or replace function public.record_ambiguity(
  p_run_id uuid,
  p_translation_key text,
  p_locale text,
  p_source_text text,
  p_proposed_text text,
  p_question text,
  p_alternatives jsonb
)
returns public.run_ambiguities
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.runs;
  saved public.run_ambiguities;
begin
  select * into parent from public.runs where id = p_run_id;
  if parent.id is null then
    raise exception 'run not found' using errcode = '42704';
  end if;
  if not public.is_org_member(parent.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.run_ambiguities (
    run_id, project_id, organization_id,
    translation_key, locale, source_text,
    proposed_text, question, alternatives
  )
  values (
    parent.id, parent.project_id, parent.organization_id,
    p_translation_key, p_locale, p_source_text,
    p_proposed_text, p_question, coalesce(p_alternatives, '[]'::jsonb)
  )
  on conflict (run_id, translation_key, locale) do update set
    proposed_text = excluded.proposed_text,
    question = excluded.question,
    alternatives = excluded.alternatives
  returning * into saved;

  return saved;
end;
$$;

/**
 * Answering a question, or declining to.
 *
 * Dismissing keeps the model's proposal — it means "your suggestion is fine",
 * not "drop this string". There is no outcome in which a key silently loses
 * its translation because nobody wanted to think about it.
 */
create or replace function public.resolve_ambiguity(
  p_ambiguity_id uuid,
  p_resolved_text text,
  p_dismiss boolean default false
)
returns public.run_ambiguities
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.run_ambiguities;
  updated public.run_ambiguities;
begin
  select * into existing from public.run_ambiguities where id = p_ambiguity_id;
  if existing.id is null then
    raise exception 'ambiguity not found' using errcode = '42704';
  end if;
  if not public.is_org_member(existing.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if p_dismiss then
    update public.run_ambiguities set
      state = 'dismissed',
      resolved_text = null,
      resolved_by = auth.uid(),
      resolved_at = now()
    where id = p_ambiguity_id
    returning * into updated;
    return updated;
  end if;

  if p_resolved_text is null or length(trim(p_resolved_text)) = 0 then
    raise exception 'a resolution needs text' using errcode = '22023';
  end if;

  update public.run_ambiguities set
    state = 'resolved',
    resolved_text = p_resolved_text,
    resolved_by = auth.uid(),
    resolved_at = now()
  where id = p_ambiguity_id
  returning * into updated;

  return updated;
end;
$$;

revoke execute on function public.record_ambiguity(uuid, text, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.resolve_ambiguity(uuid, text, boolean) from public, anon;
grant execute on function public.record_ambiguity(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.resolve_ambiguity(uuid, text, boolean) to authenticated;
