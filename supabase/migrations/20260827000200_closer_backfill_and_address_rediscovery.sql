-- Closer — two gaps left by the canonicalisation migration, and the discovery
-- check that was only half of what it claimed.
--
-- Both were found by a read-only audit that reproduced them; neither lets
-- anybody be contacted. They are data integrity and visibility.

/* ------------------------------------------------------------------ *
 * C2 — rows written before canonicalisation were never backfilled
 * ------------------------------------------------------------------ */

/*
 * `20260827000100` canonicalised on write and left existing rows alone. The
 * guard compensates by canonicalising the stored side at comparison time — that
 * arm is verified — so suppression still works. What does not work is identity:
 * `closer_upsert_company` now canonicalises its input, so a company row holding
 * `acme.example.` is no longer found by `on conflict (organization_id, domain)`.
 *
 * Reproduced: with a pre-migration row `legacy-co.test.invalid.`, rediscovering
 * `legacy-co.test.invalid` produced **two** company rows instead of updating
 * one, splitting the company's evidence between them.
 *
 * Both projects hold zero companies today, so this is a no-op where it runs and
 * a correctness fix where it would not have been.
 *
 * **Rows that would collide are left alone.** If two rows already canonicalise
 * to the same domain, one of them is a duplicate that predates this and merging
 * them means choosing which evidence, which lead and which history survive.
 * That is a judgement, and a migration is the wrong place to make it silently.
 * The guard catches both either way.
 */
update public.closer_companies c
   set domain = public.closer_canonical_domain(c.domain)
 where c.domain is not null
   and c.domain is distinct from public.closer_canonical_domain(c.domain)
   and not exists (
     select 1 from public.closer_companies other
     where other.organization_id = c.organization_id
       and other.id <> c.id
       and other.domain = public.closer_canonical_domain(c.domain)
   );

/*
 * The same for the suppression list.
 *
 * A collision here is harmless — two rows both meaning "suppressed" — so the
 * redundant one is left in place rather than deleted. Removing a row that
 * records somebody's withdrawal of consent, even a redundant one, is not
 * something to do as a side effect of tidying.
 */
update public.closer_suppressions s
   set domain = public.closer_canonical_domain(s.domain)
 where s.domain is not null
   and s.domain is distinct from public.closer_canonical_domain(s.domain)
   and not exists (
     select 1 from public.closer_suppressions other
     where other.organization_id = s.organization_id
       and other.id <> s.id
       and other.domain = public.closer_canonical_domain(s.domain)
   );

update public.closer_suppressions s
   set email = public.closer_canonical_address(s.email)
 where s.email is not null
   and s.email is distinct from public.closer_canonical_address(s.email)
   and public.closer_canonical_address(s.email) is not null
   and not exists (
     select 1 from public.closer_suppressions other
     where other.organization_id = s.organization_id
       and other.id <> s.id
       and other.email = public.closer_canonical_address(s.email)
   );

/* ------------------------------------------------------------------ *
 * C3 — discovery only ever checked the domain
 * ------------------------------------------------------------------ */

/*
 * `20260825000100` stopped a suppressed company reappearing through discovery,
 * and checked the domain to do it. An **address-only** opt-out — the shape
 * `recordReply` writes when a company has no domain, and the shape an operator
 * writes when they suppress one person — did not stop it.
 *
 * Reproduced, with the four guards measured separately. After an address-only
 * opt-out: the lead was stopped, drafting was refused, opening a fresh lead was
 * refused — and the company row was re-upserted anyway, reappearing in the list
 * as a live prospect. Three guards out of four, which is the same symptom the
 * earlier fix was written for, arriving by the other identifier.
 *
 * The check now mirrors `closer_open_lead`: an existing company whose contacts
 * include a suppressed address is refused. A company that does not exist yet
 * has no contacts, so there is nothing to look at and the insert proceeds —
 * that is not a hole, it is the absence of anything to check.
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
  existing public.closer_companies;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if clean_domain is not null
     and public.closer_is_suppressed(p_organization_id, clean_domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  /*
   * The address-level check, on the company this upsert would land on.
   *
   * Only meaningful for a company that already exists: a new one has no
   * contacts yet. Looked up by the canonical domain, which is what the upsert
   * below will conflict against.
   */
  if clean_domain is not null then
    select * into existing from public.closer_companies
     where organization_id = p_organization_id and domain = clean_domain;

    if existing.id is not null and exists (
      select 1 from public.closer_contacts ct
      where ct.company_id = existing.id
        and public.closer_is_suppressed(p_organization_id, null, ct.email)
    ) then
      raise exception 'a contact at this company has asked not to be contacted'
        using errcode = '42501';
    end if;
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
