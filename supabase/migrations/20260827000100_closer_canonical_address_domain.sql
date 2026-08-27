-- Closer — canonicalise the domain before comparing it.
--
-- The previous fix made a domain-level opt-out cover addresses at that domain,
-- with `s.domain = lower(split_part(p_email, '@', 2))`. That is string equality
-- on a token which is neither canonicalised nor reliably extracted, and an
-- audit reproduced three ways past it, each reaching an **approved message**:
--
--   evader@acme.example.     a trailing dot — the same mailbox, a different string
--   x@acme.example..         two of them
--   "a@b"@acme.example       a quoted local part containing '@', so `split_part`
--                            returned `b"` and never saw the domain at all
--
-- `split_part(…, '@', 2)` takes the *second* token. An address whose local part
-- contains an '@' has its domain in the third. Everything after the **last**
-- '@' is the domain, always.
--
-- The comparison is now between canonical forms on both sides, so a suppression
-- row written before this migration — possibly with its own trailing dot —
-- still matches. Canonicalising only the incoming value would have left the
-- stored side able to miss.
--
-- **Stored addresses are not rewritten.** `closer_contacts.email` keeps
-- whatever was recorded, because that column is a fact about how a person was
-- found and quietly editing it would make the row disagree with the source it
-- names. Canonicalisation belongs to matching, not to the record.
--
-- Scope worth stating: subdomains are still distinct. `sub@mail.acme.example`
-- is not covered by a suppression of `acme.example`, and that remains a
-- deliberate reading of "identifier", not an oversight — a different domain is
-- a different party. What this closes is the case where the domain is the
-- *same* and only the spelling differed.

/* ------------------------------------------------------------------ *
 * The canonical forms, in one place
 * ------------------------------------------------------------------ */

/*
 * A domain, comparable.
 *
 * Trimmed, lowercased, and stripped of the trailing dots that make an FQDN
 * absolute — `acme.example.` and `acme.example` name the same zone and deliver
 * to the same mailbox. Empty becomes null so that a blank never matches
 * anything: `null = null` is null, which is what "no domain" should behave
 * like in a WHERE clause.
 */
create or replace function public.closer_canonical_domain(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(btrim(p_value)), '\.+$', ''), '');
$$;

/*
 * The domain of an address: everything after the LAST '@'.
 *
 * The greedy `^.*@` is what makes a quoted local part harmless. An address
 * with no '@' has no domain and returns null rather than being mistaken for
 * one — the earlier `split_part` returned an empty string here, which is why
 * the previous version needed a separate non-empty test.
 */
create or replace function public.closer_address_domain(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else public.closer_canonical_domain(regexp_replace(p_email, '^.*@', ''))
  end;
$$;

/*
 * A whole address, comparable: the local part as written, lowercased, joined to
 * the canonical domain.
 *
 * The local part is case-sensitive by RFC and case-insensitive in practice
 * everywhere it matters; this repository already lowercases addresses on write,
 * so lowering here changes nothing and keeps the two consistent.
 */
create or replace function public.closer_canonical_address(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else lower(btrim(regexp_replace(p_email, '@[^@]*$', '')))
         || '@' || public.closer_address_domain(p_email)
  end;
$$;

/* ------------------------------------------------------------------ *
 * The guard, comparing canonical forms on both sides
 * ------------------------------------------------------------------ */

/*
 * Three arms, unchanged in intent:
 *
 *   the company's domain against the domain list;
 *   the address against the address list;
 *   the address's own domain against the domain list — the arm added last
 *   time, now looking at the right token.
 *
 * Every comparison canonicalises both operands. That costs the indexes on
 * `closer_suppressions`, which is acceptable: the table holds one row per
 * identifier a workspace has ever suppressed, and a sequential scan over it is
 * cheaper than the class of bug this replaces.
 */
create or replace function public.closer_is_suppressed(
  p_organization_id uuid,
  p_domain text,
  p_email text
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.closer_suppressions s
    where s.organization_id = p_organization_id
      and (
        (
          p_domain is not null
          and public.closer_canonical_domain(s.domain)
              = public.closer_canonical_domain(p_domain)
        )
        or (
          p_email is not null
          and public.closer_canonical_address(s.email)
              = public.closer_canonical_address(p_email)
        )
        or (
          p_email is not null
          and public.closer_canonical_domain(s.domain)
              = public.closer_address_domain(p_email)
        )
      )
  );
$$;

/* ------------------------------------------------------------------ *
 * Canonical on the way in, too
 * ------------------------------------------------------------------ */

/*
 * New rows are stored canonically so the comparison above has less work to do
 * and so `\d` shows what is actually being matched. The guard still
 * canonicalises the stored side, because rows written before this migration
 * were not.
 */
create or replace function public.closer_suppress(
  p_organization_id uuid,
  p_domain text,
  p_email text,
  p_reason public.closer_suppression_reason,
  p_note text default null
)
returns public.closer_suppressions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created public.closer_suppressions;
  affected public.closer_leads;
  clean_domain text := public.closer_canonical_domain(p_domain);
  clean_email text := public.closer_canonical_address(p_email);
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.closer_suppressions
    (organization_id, domain, email, reason, note)
  values
    (p_organization_id, clean_domain, clean_email, p_reason, p_note)
  on conflict do nothing
  returning * into created;

  if created.id is null then
    select * into created from public.closer_suppressions
     where organization_id = p_organization_id
       and (domain is not distinct from clean_domain)
       and (email is not distinct from clean_email);
  end if;

  for affected in
    select l.* from public.closer_leads l
    join public.closer_companies c on c.id = l.company_id
    where l.organization_id = p_organization_id
      and l.stage <> 'do_not_contact'
      and (
        public.closer_is_suppressed(p_organization_id, c.domain, null)
        or exists (
          select 1 from public.closer_contacts ct
          where ct.company_id = c.id
            and public.closer_is_suppressed(p_organization_id, null, ct.email)
        )
      )
  loop
    perform public.closer_set_stage(
      affected.id, 'do_not_contact', 'Suppressed: ' || p_reason::text
    );
  end loop;

  return created;
end;
$$;

/*
 * A company's domain, canonical for the same reason.
 *
 * Otherwise the evasion works from the other side: a company stored as
 * `acme.example.` would not be matched by a suppression of `acme.example`.
 */
create or replace function public.closer_upsert_company(
  p_organization_id uuid,
  p_name text,
  p_domain text,
  p_discovered_from public.closer_evidence_source,
  p_discovered_url text default null,
  p_repository text default null,
  p_tech_stack text[] default '{}',
  p_locales text[] default '{}',
  p_employee_estimate int default null
)
returns public.closer_companies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.closer_companies;
  clean_domain text := public.closer_canonical_domain(p_domain);
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if clean_domain is not null
     and public.closer_is_suppressed(p_organization_id, clean_domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  if clean_domain is null then
    insert into public.closer_companies
      (organization_id, name, domain, repository, discovered_from, discovered_url,
       tech_stack, locales, employee_estimate)
    values
      (p_organization_id, p_name, null, p_repository, p_discovered_from, p_discovered_url,
       coalesce(p_tech_stack, '{}'), coalesce(p_locales, '{}'), p_employee_estimate)
    returning * into result;
    return result;
  end if;

  insert into public.closer_companies
    (organization_id, name, domain, repository, discovered_from, discovered_url,
     tech_stack, locales, employee_estimate)
  values
    (p_organization_id, p_name, clean_domain, p_repository, p_discovered_from,
     p_discovered_url, coalesce(p_tech_stack, '{}'), coalesce(p_locales, '{}'),
     p_employee_estimate)
  on conflict (organization_id, domain) do update
    set name = excluded.name,
        repository = coalesce(excluded.repository, public.closer_companies.repository),
        tech_stack = case when array_length(excluded.tech_stack, 1) is null
                          then public.closer_companies.tech_stack
                          else excluded.tech_stack end,
        locales = case when array_length(excluded.locales, 1) is null
                       then public.closer_companies.locales
                       else excluded.locales end,
        employee_estimate = coalesce(excluded.employee_estimate,
                                     public.closer_companies.employee_estimate),
        updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke execute on function public.closer_canonical_domain(text) from public, anon;
revoke execute on function public.closer_address_domain(text) from public, anon;
revoke execute on function public.closer_canonical_address(text) from public, anon;
grant execute on function public.closer_canonical_domain(text) to authenticated;
grant execute on function public.closer_address_domain(text) to authenticated;
grant execute on function public.closer_canonical_address(text) to authenticated;
