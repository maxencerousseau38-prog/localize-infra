-- Closer — opt-out, suppression and lead creation, proved against the database.
--
-- Written after a pre-merge audit found that suppressing by **email** stopped
-- no lead at all: `closer_suppress` reached the contact through
-- `closer_leads.contact_id`, a column nothing in this repository has ever
-- written. The domain half worked, which is why the hole was invisible — every
-- company with a resolvable homepage was stopped by its domain row, and only a
-- company with a null domain went unprotected.
--
-- It was found by exercising the function, never by reading it. So it is
-- exercised here, permanently.
--
-- Same shape as `tenant-isolation.sql`: fixtures, assertions, then a deliberate
-- RAISE that aborts the transaction so the database is left exactly as it was
-- found. Read the results out of the error message. Not wired into
-- `npm run gates` for the same reason as that file — CI has no database.

do $$
declare
  u uuid := '33333333-3333-3333-3333-333333333333';
  org uuid;
  c_domain public.closer_companies;   -- has a domain
  c_nodomain public.closer_companies; -- has none: the case the bug hit
  ct_a public.closer_contacts;
  ct_b public.closer_contacts;
  ct_c public.closer_contacts;
  lead_a public.closer_leads;
  lead_b public.closer_leads;
  stage_now public.closer_stage;
  n int; ok boolean; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','closer@test.invalid','',now(),now())
  on conflict (id) do nothing;

  -- Claims first, while still the owner role.
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  org := (public.create_organization('Closer Test','closer-test-'||floor(random()*100000)::text)).id;

  c_domain := public.closer_upsert_company(
    org,'WithDomain','with-domain.test.invalid','github_repository',
    'https://github.com/t/a','t/a');
  c_nodomain := public.closer_upsert_company(
    org,'NoDomain',null,'github_repository',
    'https://github.com/t/b','t/b');

  ct_a := public.closer_record_contact(c_domain.id,'github_repository','https://github.com/t/a','A','Eng','a@with-domain.test.invalid');
  ct_b := public.closer_record_contact(c_domain.id,'github_repository','https://github.com/t/a','B','Eng','b@with-domain.test.invalid');
  ct_c := public.closer_record_contact(c_nodomain.id,'github_repository','https://github.com/t/b','C','Eng','c@elsewhere.test.invalid');

  lead_a := public.closer_open_lead(c_domain.id);
  lead_b := public.closer_open_lead(c_nodomain.id);

  /* ---- lead creation ------------------------------------------------ */

  ok := (public.closer_open_lead(c_domain.id)).id = lead_a.id;
  r := r || format('open-lead-idempotent=%s(want t); ', ok);

  select count(*) into n from public.closer_stage_history where lead_id = lead_a.id;
  r := r || format('one-history-row-on-reopen=%s(want 1); ', n);

  /* ---- transitions --------------------------------------------------- */

  ok := false;
  begin perform public.closer_set_stage(lead_a.id,'won','Skipping the funnel',u);
  exception when others then ok := true; end;
  r := r || format('illegal-edge-refused=%s(want t); ', ok);

  ok := false;
  begin perform public.closer_set_stage(lead_a.id,'researching','   ',u);
  exception when others then ok := true; end;
  r := r || format('empty-reason-refused=%s(want t); ', ok);

  -- Walk both leads deep enough that stopping them is a real move.
  perform public.closer_set_stage(lead_a.id,'researching','Research begins',u);
  perform public.closer_set_stage(lead_a.id,'qualified','Evidence supports a fit',u);
  perform public.closer_set_stage(lead_b.id,'researching','Research begins',u);
  perform public.closer_set_stage(lead_b.id,'qualified','Evidence supports a fit',u);

  select count(*) into n from public.closer_stage_transitions where from_stage = 'do_not_contact';
  r := r || format('do-not-contact-terminal=%s(want 0); ', n);

  /* ---- opt-out: the company WITHOUT a domain ------------------------- */
  -- The regression. Only an email identifier exists here, so if the email arm
  -- of the loop is unreachable this lead is never stopped.

  perform public.closer_suppress(org,null,ct_c.email,'opted_out','audit');

  select stage into stage_now from public.closer_leads where id = lead_b.id;
  r := r || format('email-optout-stops-nodomain-lead=%s(want do_not_contact); ', stage_now);

  ok := false;
  begin perform public.closer_draft_message(
    lead_b.id, ct_c.id, 'email', 'After the opt-out.',
    array[gen_random_uuid()], 'Nope');
  exception when others then ok := true; end;
  r := r || format('draft-after-optout-refused=%s(want t); ', ok);

  /* ---- opt-out reaches a colleague ----------------------------------- */
  -- One person asking to be left alone is not an invitation to write to the
  -- next desk. Suppressing A must stop the lead B is reached through.

  perform public.closer_suppress(org,null,ct_a.email,'opted_out','audit');
  select stage into stage_now from public.closer_leads where id = lead_a.id;
  r := r || format('email-optout-stops-colleagues-lead=%s(want do_not_contact); ', stage_now);

  -- And it is idempotent: a second call writes no second stop.
  perform public.closer_suppress(org,null,ct_a.email,'opted_out','audit again');
  select count(*) into n from public.closer_stage_history
   where lead_id = lead_a.id and to_stage = 'do_not_contact';
  r := r || format('one-stop-row-after-two-suppressions=%s(want 1); ', n);

  /* ---- a suppressed contact blocks a NEW lead ------------------------ */

  delete from public.closer_leads where id = lead_b.id;
  ok := false;
  begin perform public.closer_open_lead(c_nodomain.id);
  exception when others then ok := true; end;
  r := r || format('new-lead-blocked-by-suppressed-contact=%s(want t); ', ok);

  /* ---- a suppressed company must not come back through discovery ----- */
  -- The D2 regression. `closer_upsert_company` checked membership and nothing
  -- else, so the next discovery run re-upserted a company that had opted out
  -- and it reappeared in the list looking like a fresh prospect. Contact was
  -- never possible — five other guards saw to that — but a name somebody
  -- promised never to look at again was back on the screen.
  perform public.closer_suppress(org, 'with-domain.test.invalid', null, 'opted_out', 'audit');

  ok := false;
  begin perform public.closer_upsert_company(
    org,'WithDomain','with-domain.test.invalid','github_repository',
    'https://github.com/t/a','t/a');
  exception when others then ok := true; end;
  r := r || format('rediscovery-of-suppressed-company-refused=%s(want t); ', ok);

  -- A different company is untouched: the check is scoped to the identifier,
  -- not a blanket stop on discovery.
  ok := true;
  begin perform public.closer_upsert_company(
    org,'Unrelated','unrelated.test.invalid','github_repository',
    'https://github.com/t/c','t/c');
  exception when others then ok := false; end;
  r := r || format('unsuppressed-company-still-discoverable=%s(want t); ', ok);

  -- A company with no domain has no identifier to check, and must still be
  -- recordable — that is the early-stage team discovery exists to find.
  ok := true;
  begin perform public.closer_upsert_company(
    org,'NoDomainTwo',null,'github_repository','https://github.com/t/d','t/d');
  exception when others then ok := false; end;
  r := r || format('nodomain-company-still-recordable=%s(want t); ', ok);

  raise exception 'CLOSER-SUPPRESSION >> %', r;
end $$;
