-- Closer — the opt-out that did not stop anything.
--
-- `closer_suppress` writes the suppression row and then walks every lead the
-- identifier reaches, stopping each at `do_not_contact`. The domain half worked.
-- The email half could never match a single row, and this is why:
--
--     left join public.closer_contacts ct on ct.id = l.contact_id
--
-- It looked the lead's *chosen* contact up — and `closer_leads.contact_id` is
-- written by nothing in this repository. Not by `closer_open_lead`, not by
-- drafting, not by recording a reply. The column has been null on every row
-- that has ever existed, so `ct.email` was null on every row the loop
-- considered, so the email branch matched nothing, ever.
--
-- Found by a pre-merge audit probe, not by review: suppressing a lead by the
-- address of its own contact left it sitting at `interested`.
--
-- What it cost in practice, stated precisely rather than dramatically. Recording
-- an opt-out writes two suppression rows, one per identifier, so a company with
-- a domain was stopped by the domain row and the bug was invisible. A company
-- with a **null** domain — which `closer_upsert_company` deliberately allows,
-- because a repository with no resolvable homepage is exactly the early-stage
-- team discovery is looking for — had only the email row, and so was not
-- stopped at all. Drafting to it was still refused, by the suppression check
-- that runs on the address directly; but the `do_not_contact` guard, which runs
-- first and is the one that does not depend on an identifier, was absent, and
-- the funnel showed an opted-out company as a live lead.
--
-- The fix matches **any contact of the company**, not the lead's chosen one.
-- That is also the more correct rule: one person at a company asking to be left
-- alone is not an invitation to write to their colleague, which is already what
-- the domain half does and what the interface tells the reader has happened.

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
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  insert into public.closer_suppressions
    (organization_id, domain, email, reason, note)
  values
    (p_organization_id, lower(p_domain), lower(p_email), p_reason, p_note)
  on conflict do nothing
  returning * into created;

  if created.id is null then
    select * into created from public.closer_suppressions
     where organization_id = p_organization_id
       and (domain is not distinct from lower(p_domain))
       and (email is not distinct from lower(p_email));
  end if;

  /*
   * Stop every lead this identifier reaches, unless it has already stopped.
   *
   * The email arm is an EXISTS over the company's contacts rather than a join
   * through `l.contact_id`. See the header: that column is never written, so
   * the previous form was unreachable code wearing the shape of a check.
   */
  for affected in
    select l.* from public.closer_leads l
    join public.closer_companies c on c.id = l.company_id
    where l.organization_id = p_organization_id
      and l.stage <> 'do_not_contact'
      and (
        (p_domain is not null and c.domain = lower(p_domain))
        or (
          p_email is not null
          and exists (
            select 1 from public.closer_contacts ct
            where ct.company_id = c.id and ct.email = lower(p_email)
          )
        )
      )
  loop
    perform public.closer_set_stage(
      affected.id, 'do_not_contact', 'Suppressed: ' || p_reason::text, auth.uid()
    );
  end loop;

  return created;
end;
$$;

/*
 * The same hole on the way in.
 *
 * `closer_open_lead` refused a suppressed *domain* and said nothing about
 * addresses, so a company with a null domain whose only contact had opted out
 * could still acquire a fresh lead — the exact case above, arriving from the
 * other direction. It now also refuses when any contact of that company is
 * suppressed by address.
 */
create or replace function public.closer_open_lead(p_company_id uuid)
returns public.closer_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company public.closer_companies;
  created public.closer_leads;
  suppressed_contact text;
begin
  select * into company from public.closer_companies where id = p_company_id;
  if company.id is null then
    raise exception 'company not found' using errcode = '42704';
  end if;
  if not public.is_org_member(company.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  -- Checked before the row exists, so a suppressed domain never acquires a lead
  -- that then has to be walked back.
  if public.closer_is_suppressed(company.organization_id, company.domain, null) then
    raise exception 'this company is suppressed' using errcode = '42501';
  end if;

  select ct.email into suppressed_contact
  from public.closer_contacts ct
  join public.closer_suppressions s
    on s.organization_id = ct.organization_id and s.email = ct.email
  where ct.company_id = company.id
  limit 1;

  if suppressed_contact is not null then
    raise exception 'a contact at this company has asked not to be contacted'
      using errcode = '42501';
  end if;

  insert into public.closer_leads (organization_id, company_id)
  values (company.organization_id, company.id)
  on conflict (organization_id, company_id) do nothing
  returning * into created;

  if created.id is null then
    -- Rediscovery is normal and is not an error: discovery runs repeatedly and
    -- finds the same companies. The existing lead, at whatever stage it reached,
    -- is the answer.
    select * into created from public.closer_leads
     where organization_id = company.organization_id and company_id = company.id;
    return created;
  end if;

  insert into public.closer_stage_history
    (organization_id, lead_id, from_stage, to_stage, actor, reason)
  values
    (company.organization_id, created.id, null, 'discovered', auth.uid(), 'Discovered');

  return created;
end;
$$;
