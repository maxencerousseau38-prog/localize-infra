-- The browser spends the same money, and nothing counted it.
--
-- `20260917000100` stopped a runaway CLI token. It could not stop a runaway
-- browser, and the reason is structural rather than an oversight: `apps/web`
-- calls `/v1/translate` with the **operator** bearer, and `checkQuota` returns
-- immediately for an operator caller without touching this database. So the one
-- path that writes a `runs` row — the one a customer actually clicks — was the
-- one path with no ceiling at all.
--
-- Worse, the comment justifying that exemption said the operator token is
-- "held by `apps/web`, which has its own guards". It had none. That is the same
-- shape as `isOperator` and `operatorInstallationId`, which three comments
-- described as the thing separating tenants while nothing called them.
--
-- **This is not a second system, and deliberately so.**
--
-- The daily ceiling needed no change whatsoever: `api_usage_daily` is already
-- keyed `(organization_id, usage_date)`, so browser spending now lands in the
-- same row as CLI spending. That is what "per workspace" already meant — the
-- browser was simply never counted. One workspace, one ceiling, whichever way
-- it spends.
--
-- Only the rate window needed widening, because it was keyed by a CLI token and
-- a browser run has none. Rather than a parallel table, the subject becomes
-- "a token **or** a workspace", which keeps one function, one set of numbers,
-- and one place to reason about.
--
-- Nothing here changes what a CLI token may spend: same limits, same window,
-- same row shape, same refusal.

alter table public.api_rate_windows
  add column organization_id uuid
    references public.organizations (id) on delete cascade;

/*
 * The primary key becomes two partial unique indexes, because a nullable
 * column cannot sit in a primary key.
 *
 * **The order below is load-bearing, and the first attempt had it wrong.**
 * Dropping the NOT NULL before the primary key fails outright — `column
 * "token_id" is in a primary key` — because the key implies it. The key goes
 * first, then the column may become nullable. Caught by applying this to the
 * development database rather than by reading it.
 *
 * Behaviour for a token is unchanged — one row per token and route, rewritten
 * in place — and the two subjects cannot collide, because each index ignores
 * the rows belonging to the other.
 */
alter table public.api_rate_windows
  drop constraint api_rate_windows_pkey;

alter table public.api_rate_windows
  alter column token_id drop not null;

-- Exactly one subject. A row naming both, or neither, is a bug in the caller
-- rather than something to interpret at read time.
alter table public.api_rate_windows
  add constraint api_rate_windows_one_subject
    check (num_nonnulls(token_id, organization_id) = 1);

create unique index api_rate_windows_token_route
  on public.api_rate_windows (token_id, route)
  where token_id is not null;

create unique index api_rate_windows_organization_route
  on public.api_rate_windows (organization_id, route)
  where organization_id is not null;

/**
 * Charge one request against both guards, and say whether it may proceed.
 *
 * Unchanged for a CLI token. The one difference is that `p_token_id` may now be
 * **null**, meaning "the workspace itself is the subject" — which is how a
 * browser run is charged, since it carries no token of its own.
 *
 * `create or replace` rather than drop-and-create, so the grants placed by
 * `20260917000100` survive: `service_role` only, revoked from everyone else.
 */
create or replace function public.consume_api_quota(
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
  -- The organization is still required; the token no longer is. A call naming
  -- neither has no subject to charge and nowhere to charge it.
  if p_organization_id is null then
    raise exception 'organization is required' using errcode = '22023';
  end if;

  select * into lim from public.api_limits();
  per_minute := case p_route
    when 'translate' then lim.translate_per_minute
    else lim.open_pr_per_minute
  end;

  /*
   * The rate window, first and atomically, against whichever subject was
   * named. The two branches are the same statement over different unique
   * indexes: `on conflict` cannot take a computed target, so the duplication
   * is the price of keeping the read and the write in one statement — which is
   * what stops two concurrent requests both seeing "count = limit - 1".
   */
  if p_token_id is not null then
    insert into public.api_rate_windows (
      token_id, organization_id, route, window_started_at, request_count
    )
    values (p_token_id, null, p_route, now(), 1)
    on conflict (token_id, route) where token_id is not null do update
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
  else
    insert into public.api_rate_windows (
      token_id, organization_id, route, window_started_at, request_count
    )
    values (null, p_organization_id, p_route, now(), 1)
    on conflict (organization_id, route) where organization_id is not null do update
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
  end if;

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

  -- The daily ceiling. Unchanged, and shared: this row is the workspace's
  -- whole spending for the day, from the browser and from every CLI token.
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
