-- Cost protection: what a personal CLI token may spend, and how fast.
--
-- Until now a valid `lit_` token could call `/v1/translate` in a loop. Every
-- call reaches a paid model on the operator's account, so the only thing
-- between a runaway script — or one shared token — and an unbounded bill was
-- that nobody had tried.
--
-- Two guards, deliberately separate because they answer different failures:
--
-- * **A rate window per token.** Catches a loop: the same credential calling
--   faster than a person ever would. Per token, because that is the unit a
--   person can revoke.
-- * **A daily ceiling per workspace.** Catches sustained spend that is not
--   fast enough to trip the window. Per workspace, because that is the unit
--   the product bills and entitles.
--
-- **This is abuse protection, not metering.** Invariant 3 of this project
-- forbids billing by word, character or key, and `/pricing` says so in public.
-- Nothing here is charged for, nothing accumulates into an invoice, and the
-- ceiling is set where a real project never reaches it. The counters exist so
-- the operator can see what was spent and so a runaway stops; the site says
-- the ceiling exists, because a limit a user can hit and has not been told
-- about is the kind of claim this repository is not allowed to leave standing.
--
-- The operator token (`API_AUTH_TOKEN`) is never limited here: it is
-- server-to-server, held by `apps/web`, and it never reaches this function.
-- The API does not call it for operator callers at all.

create table public.api_usage_daily (
  organization_id uuid not null
    references public.organizations (id) on delete cascade,

  -- UTC, because the function that writes it uses `now()` and a day boundary
  -- that moves with a viewer's timezone is a day boundary nobody can reason
  -- about when reading the row later.
  usage_date date not null,

  strings_translated integer not null default 0 check (strings_translated >= 0),
  translate_requests integer not null default 0 check (translate_requests >= 0),
  prs_opened integer not null default 0 check (prs_opened >= 0),

  updated_at timestamptz not null default now(),

  primary key (organization_id, usage_date)
);

alter table public.api_usage_daily enable row level security;

-- Members may read what their own workspace spent. There is no write policy:
-- the counters are written by the definer function below, called by the API
-- with the service role, and by nothing else.
create policy api_usage_select_member
  on public.api_usage_daily
  for select to authenticated
  using (public.is_org_member(organization_id));

-- One row per token and route, rewritten in place. Not an event log: a row per
-- request would grow without bound and would need a sweeper, and the question
-- being asked — "how many in the last minute" — needs one counter, not a
-- history.
create table public.api_rate_windows (
  token_id uuid not null
    references public.cli_tokens (id) on delete cascade,
  route text not null check (route in ('translate', 'open_pr')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (token_id, route)
);

alter table public.api_rate_windows enable row level security;
-- No policy at all: this table answers nothing a client needs, and a client
-- that could read it would learn other members' call patterns.
revoke all on public.api_rate_windows from anon, authenticated;

/**
 * The limits, in one place.
 *
 * Written as a function rather than a table because v1 has one set of numbers
 * for everyone: a plan-dependent ceiling is a billing decision, and billing
 * does not exist yet. When it does, this is the single place that reads the
 * entitlement instead.
 */
create function public.api_limits()
returns table (
  translate_per_minute integer,
  open_pr_per_minute integer,
  strings_per_day integer,
  prs_per_day integer
)
language sql
immutable
set search_path = public, pg_temp
as $$
  -- 30 translate calls a minute: the CLI sends one request per locale, so even
  -- a 10-locale run is 10 calls in a few seconds and stays far below.
  -- 10 pull requests a minute: opening one is several GitHub writes, and a
  -- human never needs a second one within six seconds.
  -- 5000 strings a day: the fixture project extracts 3 strings; a large app
  -- extracting 400 strings into 5 locales spends 2000. Two full runs of a big
  -- project a day fit; a loop does not.
  -- 50 pull requests a day: one per run, and 50 runs a day is already a script.
  select 30, 10, 5000, 50;
$$;

/**
 * Charge one request against both guards, and say whether it may proceed.
 *
 * Called by `apps/api` **before** the work happens, because the work is what
 * costs money. A refused request is not charged to the daily ceiling, but it
 * does count against the rate window: a caller hammering a closed door is
 * exactly what the window exists to slow down.
 *
 * Returns one row. `allowed = false` carries the reason ('rate' or 'quota'),
 * how long to wait, and where the caller stands, so the API can answer with a
 * sentence rather than a bare 429.
 */
create function public.consume_api_quota(
  p_token_id uuid,
  p_organization_id uuid,
  p_route text,
  p_units integer
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer,
  used integer,
  limit_value integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lim record;
  window_row public.api_rate_windows;
  usage_row public.api_usage_daily;
  per_minute integer;
  window_age interval;
  today date := (now() at time zone 'utc')::date;
begin
  if p_route not in ('translate', 'open_pr') then
    raise exception 'unknown route: %', p_route using errcode = '22023';
  end if;
  -- A request that claims to carry no work, or absurdly much of it, is a bug
  -- in the caller rather than something to charge for.
  if p_units is null or p_units < 1 or p_units > 10000 then
    raise exception 'units must be between 1 and 10000' using errcode = '22023';
  end if;
  if p_token_id is null or p_organization_id is null then
    raise exception 'token and organization are required' using errcode = '22023';
  end if;

  select * into lim from public.api_limits();
  per_minute := case p_route
    when 'translate' then lim.translate_per_minute
    else lim.open_pr_per_minute
  end;

  -- The rate window, first and atomically. `on conflict do update` with the
  -- age test inside it keeps the read and the write in one statement, so two
  -- concurrent requests cannot both see "count = limit - 1".
  insert into public.api_rate_windows (
    token_id, route, window_started_at, request_count
  )
  values (p_token_id, p_route, now(), 1)
  on conflict (token_id, route) do update
    set window_started_at = case
          when public.api_rate_windows.window_started_at > now() - interval '1 minute'
            then public.api_rate_windows.window_started_at
          else now()
        end,
        request_count = case
          when public.api_rate_windows.window_started_at > now() - interval '1 minute'
            then public.api_rate_windows.request_count + 1
          else 1
        end
  returning * into window_row;

  if window_row.request_count > per_minute then
    window_age := now() - window_row.window_started_at;
    return query select
      false,
      'rate'::text,
      greatest(1, ceil(extract(epoch from (interval '1 minute' - window_age)))::integer),
      window_row.request_count,
      per_minute;
    return;
  end if;

  -- The daily ceiling. The row is created on first use of the day, so a
  -- workspace that never calls the API has no rows at all.
  insert into public.api_usage_daily (organization_id, usage_date)
  values (p_organization_id, today)
  on conflict (organization_id, usage_date) do update
    set updated_at = public.api_usage_daily.updated_at
  returning * into usage_row;

  if p_route = 'translate' then
    if usage_row.strings_translated + p_units > lim.strings_per_day then
      return query select
        false,
        'quota'::text,
        greatest(1, ceil(extract(epoch from ((today + 1)::timestamptz - now())))::integer),
        usage_row.strings_translated,
        lim.strings_per_day;
      return;
    end if;
    update public.api_usage_daily
       set strings_translated = strings_translated + p_units,
           translate_requests = translate_requests + 1,
           updated_at = now()
     where organization_id = p_organization_id and usage_date = today
    returning * into usage_row;
    return query select
      true, null::text, 0, usage_row.strings_translated, lim.strings_per_day;
    return;
  end if;

  if usage_row.prs_opened + p_units > lim.prs_per_day then
    return query select
      false,
      'quota'::text,
      greatest(1, ceil(extract(epoch from ((today + 1)::timestamptz - now())))::integer),
      usage_row.prs_opened,
      lim.prs_per_day;
    return;
  end if;
  update public.api_usage_daily
     set prs_opened = prs_opened + p_units,
         updated_at = now()
   where organization_id = p_organization_id and usage_date = today
  returning * into usage_row;
  return query select
    true, null::text, 0, usage_row.prs_opened, lim.prs_per_day;
end;
$$;

-- Same shape as resolve_cli_token: the API holds the service role and nobody
-- signed in may charge, refund or inspect another workspace's window.
revoke execute on function public.consume_api_quota(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_quota(uuid, uuid, text, integer)
  to service_role;

-- Readable by anyone signed in: it is the same set of numbers the marketing
-- site publishes, and a workspace reading its own usage needs the denominator.
grant execute on function public.api_limits() to authenticated, service_role;
