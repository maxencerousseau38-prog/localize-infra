-- Closer — a suppressed company must not come back through discovery.
--
-- `closer_upsert_company` checked membership and nothing else. So a company
-- that had asked to be left alone was re-upserted by the next discovery run,
-- its evidence re-recorded, and it reappeared on `/closer/companies` looking
-- like a fresh prospect.
--
-- Found by a production smoke test, not by review, and the shape of the defect
-- is one this repository has now seen three times: **a comment asserting a
-- check that does not exist.** `discoverCompanies` said, beside its error
-- branch, "A suppressed domain raises here, and that is the system working".
-- It did not raise. The comment described the behaviour somebody intended and
-- nobody wrote.
--
-- Scope, stated precisely rather than dramatically. Contactability was never
-- at risk: `closer_open_lead` refused, the existing lead stayed at
-- `do_not_contact`, and drafting, approving and moving the lead were all
-- refused — five separate guards, all verified. What leaked was *visibility*:
-- a suppressed company in a list, and a discovery run counting it as recorded.
-- That is a hygiene defect, and it is also how an operator ends up looking at a
-- name they promised never to look at again.
--
-- The check goes here rather than in the application because discovery is not
-- the only caller this function will ever have.

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
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  /*
   * Suppression outranks discovery.
   *
   * Checked on the domain only, which is the identifier a company has before
   * anybody has found a person at it. An address-level opt-out still stops the
   * lead and every outreach path; what this closes is the company row coming
   * back into view.
   *
   * Raised rather than returning the existing row silently: `discoverCompanies`
   * already has a `skipped` list built for exactly this, and a run that says
   * "skipped acme.example (this company is suppressed)" is the honest report.
   */
  if p_domain is not null
     and public.closer_is_suppressed(p_organization_id, p_domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  if p_domain is null then
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
    (p_organization_id, p_name, lower(p_domain), p_repository, p_discovered_from,
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
