-- Cost protection: the rate window and the daily ceiling.
--
-- What is proven here is what a bill depends on. The API charges *before* it
-- spends, so if this function ever said "allowed" without counting, or counted
-- one workspace's strings against another's, the ceiling would be decoration.
--
-- Like the other proofs, it ends in a deliberate RAISE that rolls everything
-- back; supabase/tests/run.sh reads the verdict.
do $$
declare
  owner_a uuid := '5a5a5a5a-0000-4000-8000-000000000001';
  owner_b uuid := '5a5a5a5a-0000-4000-8000-000000000002';
  oa public.organizations; ob public.organizations;
  tok_a uuid; tok_a2 uuid; tok_b uuid;
  d record; n int; ok boolean; r text := '';
  lim record;
  today date := (now() at time zone 'utc')::date;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (owner_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','limits-a@test.invalid','',now(),now()),
    (owner_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','limits-b@test.invalid','',now(),now())
  on conflict (id) do nothing;

  perform set_config('request.jwt.claims', json_build_object('sub',owner_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  oa := public.create_organization('Limits A','limits-a');
  tok_a  := public.create_cli_token(oa.id, 'a1', repeat('1', 64), 'lit_a1a1a1');
  tok_a2 := public.create_cli_token(oa.id, 'a2', repeat('2', 64), 'lit_a2a2a2');

  perform set_config('request.jwt.claims', json_build_object('sub',owner_b,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  ob := public.create_organization('Limits B','limits-b');
  tok_b := public.create_cli_token(ob.id, 'b1', repeat('3', 64), 'lit_b1b1b1');

  perform set_config('role','postgres',true);
  select * into lim from public.api_limits();

  -- ---- a normal call is allowed and counted -------------------------------
  select * into d from public.consume_api_quota(tok_a, oa.id, 'translate', 12);
  r := r || format('first-call-allowed=%s(want t); ', d.allowed);
  r := r || format('first-call-used=%s(want 12); ', d.used);
  r := r || format('limit-reported=%s(want %s); ', d.limit_value, lim.strings_per_day);

  select strings_translated into n from public.api_usage_daily
   where organization_id = oa.id and usage_date = today;
  r := r || format('strings-counted=%s(want 12); ', n);
  select translate_requests into n from public.api_usage_daily
   where organization_id = oa.id and usage_date = today;
  r := r || format('requests-counted=%s(want 1); ', n);

  -- A second token of the same workspace adds to the same daily row: the
  -- ceiling is per workspace, not per credential.
  select * into d from public.consume_api_quota(tok_a2, oa.id, 'translate', 8);
  select strings_translated into n from public.api_usage_daily
   where organization_id = oa.id and usage_date = today;
  r := r || format('second-token-same-workspace-row=%s(want 20); ', n);

  -- ---- one workspace cannot spend another's ceiling ------------------------
  select * into d from public.consume_api_quota(tok_b, ob.id, 'translate', 5);
  select strings_translated into n from public.api_usage_daily
   where organization_id = oa.id and usage_date = today;
  r := r || format('B-does-not-touch-A=%s(want 20); ', n);
  select count(*) into n from public.api_usage_daily where organization_id = ob.id;
  r := r || format('B-has-own-row=%s(want 1); ', n);

  -- ---- the daily ceiling ---------------------------------------------------
  -- Straight to the edge rather than looping: the assertion is the comparison,
  -- and a loop of 5000 would only prove the same thing slowly.
  update public.api_usage_daily
     set strings_translated = lim.strings_per_day - 10
   where organization_id = oa.id and usage_date = today;

  select * into d from public.consume_api_quota(tok_a, oa.id, 'translate', 10);
  r := r || format('exactly-at-ceiling-allowed=%s(want t); ', d.allowed);

  select * into d from public.consume_api_quota(tok_a, oa.id, 'translate', 1);
  r := r || format('over-ceiling-refused=%s(want f); ', d.allowed);
  r := r || format('over-ceiling-reason=%s(want quota); ', d.reason);
  r := r || format('over-ceiling-retry-positive=%s(want t); ', d.retry_after_seconds > 0);

  -- A refused call is not charged: the ceiling does not move.
  select strings_translated into n from public.api_usage_daily
   where organization_id = oa.id and usage_date = today;
  r := r || format('refused-call-not-charged=%s(want %s); ', n, lim.strings_per_day);

  -- Yesterday's usage does not count against today.
  insert into public.api_usage_daily (organization_id, usage_date, strings_translated)
  values (ob.id, today - 1, lim.strings_per_day)
  on conflict (organization_id, usage_date) do update set strings_translated = excluded.strings_translated;
  select * into d from public.consume_api_quota(tok_b, ob.id, 'translate', 100);
  r := r || format('yesterday-does-not-count=%s(want t); ', d.allowed);

  -- ---- the rate window -----------------------------------------------------
  -- Fresh window for a route nobody has used yet, driven to its limit.
  update public.api_rate_windows set request_count = 0, window_started_at = now()
   where token_id = tok_a and route = 'translate';
  for n in 1..lim.translate_per_minute loop
    select * into d from public.consume_api_quota(tok_a, oa.id, 'open_pr', 1);
  end loop;
  r := r || format('open-pr-over-rate-refused=%s(want f); ', d.allowed);

  -- open_pr's own limit is lower than translate's, so the loop above crosses
  -- it; the reason must be the window, not the ceiling.
  r := r || format('rate-reason=%s(want rate); ', d.reason);
  r := r || format('rate-retry-within-a-minute=%s(want t); ', d.retry_after_seconds between 1 and 60);

  -- The other route of the same token is untouched: the window is per route.
  select * into d from public.consume_api_quota(tok_a, oa.id, 'translate', 1);
  r := r || format('other-route-not-rate-limited=%s(want f); ', d.allowed);
  r := r || format('other-route-reason=%s(want quota); ', d.reason);

  -- And another token is untouched: the window is per credential.
  update public.api_rate_windows set request_count = 0, window_started_at = now()
   where token_id = tok_b and route = 'open_pr';
  select * into d from public.consume_api_quota(tok_b, ob.id, 'open_pr', 1);
  r := r || format('other-token-unaffected=%s(want t); ', d.allowed);

  -- A window older than a minute starts again rather than staying closed.
  update public.api_rate_windows
     set window_started_at = now() - interval '61 seconds',
         request_count = lim.open_pr_per_minute
   where token_id = tok_b and route = 'open_pr';
  select * into d from public.consume_api_quota(tok_b, ob.id, 'open_pr', 1);
  r := r || format('window-expires=%s(want t); ', d.allowed);
  select request_count into n from public.api_rate_windows
   where token_id = tok_b and route = 'open_pr';
  r := r || format('window-restarts-at-one=%s(want 1); ', n);

  -- ---- bad input -----------------------------------------------------------
  ok := false;
  begin perform public.consume_api_quota(tok_a, oa.id, 'sideload', 1);
  exception when others then ok := true; end;
  r := r || format('unknown-route-refused=%s(want t); ', ok);

  ok := false;
  begin perform public.consume_api_quota(tok_a, oa.id, 'translate', 0);
  exception when others then ok := true; end;
  r := r || format('zero-units-refused=%s(want t); ', ok);

  ok := false;
  begin perform public.consume_api_quota(tok_a, oa.id, 'translate', 10001);
  exception when others then ok := true; end;
  r := r || format('absurd-units-refused=%s(want t); ', ok);

  -- ---- who may call it -----------------------------------------------------
  -- A signed-in user must not be able to charge, refund, or read the windows.
  perform set_config('request.jwt.claims', json_build_object('sub',owner_a,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  ok := false;
  begin perform public.consume_api_quota(tok_a, oa.id, 'translate', 1);
  exception when insufficient_privilege then ok := true; end;
  r := r || format('member-cannot-charge=%s(want t); ', ok);

  -- Not "reads zero rows": the table's grants are revoked outright, so the
  -- read is refused before RLS is even consulted. Written as a count first,
  -- which aborted the proof — a stronger answer than the one expected.
  ok := false;
  begin
    select count(*) into n from public.api_rate_windows;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('member-cannot-read-windows=%s(want t); ', ok);

  -- Its own usage, though, it may read — and only its own.
  select count(*) into n from public.api_usage_daily where organization_id = oa.id;
  r := r || format('member-sees-own-usage=%s(want 1); ', n);
  select count(*) into n from public.api_usage_daily where organization_id = ob.id;
  r := r || format('member-sees-no-other-usage=%s(want 0); ', n);

  raise exception 'API-LIMITS >> %', r;
end $$;
