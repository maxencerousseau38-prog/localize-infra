-- Closer — the internal sales operating system, core entities.
--
-- Closer lives in this database rather than a second one. It reuses the tenancy
-- already here: every row is owned by an organization, and RLS answers "may I
-- see this" through the same `is_org_member` the product uses. Closer's data is
-- the operator's own workspace, not a customer's, and that is a policy decision
-- rather than a schema one — nothing here assumes a single tenant.
--
-- Three properties this file is built to enforce, because they are what stops a
-- prospecting system from becoming a spam engine:
--
--   1. A claim without a source cannot be stored. `closer_evidence` requires a
--      source and a date on every row, and scores reference evidence rather
--      than standing alone. "Company X has this problem" is not representable;
--      "observed N translation PRs, here, on this date" is.
--   2. A stage cannot be set, only transitioned. See the companion migration:
--      the allowed edges are a table, and a definer function is the only writer.
--   3. Suppression outranks everything. A suppressed domain cannot acquire a
--      lead, and no transition can move one toward contact.
--
-- Tables are closed to direct writes, exactly like `runs`: a row a client can
-- insert is a claim, not a record.

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

-- The sales lifecycle. Terminal states are listed last and are not a
-- continuation of the funnel — a lead in one has stopped moving.
create type public.closer_stage as enum (
  'discovered',
  'researching',
  'qualified',
  'ready_for_outreach',
  'outreach_approved',
  'contacted',
  'replied',
  'interested',
  'qualified_opportunity',
  'meeting_requested',
  'meeting_booked',
  'trial',
  'negotiation',
  'won',
  -- Terminal.
  'not_a_fit',
  'not_now',
  'unresponsive',
  'lost',
  'do_not_contact'
);

-- Where a fact came from. The point of the enum is that every fact has one:
-- there is no 'inferred' member, because an inference is not a source.
create type public.closer_evidence_source as enum (
  'github_repository',
  'github_commit',
  'github_issue',
  'github_pull_request',
  'company_website',
  'public_docs',
  'job_posting',
  'changelog',
  'public_directory',
  'operator_note'
);

-- What a piece of evidence is evidence *of*.
--
-- `signal` and `pain` are deliberately separate, and the separation is the
-- point: i18next in a package.json is a signal, and a signal is not a problem.
-- Seven translation pull requests in thirty days is evidence that somebody is
-- doing the work by hand.
create type public.closer_evidence_kind as enum (
  'localization_signal',
  'pain',
  'buying_intent',
  'company_profile',
  'contact'
);

create type public.closer_score_kind as enum (
  'icp',
  'pain',
  'intent',
  'fit',
  'engagement'
);

create type public.closer_job_state as enum (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create type public.closer_suppression_reason as enum (
  'opted_out',
  'bounced',
  'complained',
  'operator_excluded',
  'competitor',
  'existing_customer'
);

/* ------------------------------------------------------------------ *
 * Companies — discovery finds these, not people.
 * ------------------------------------------------------------------ */

create table public.closer_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  -- Lowercased at write time by the RPC. The uniqueness of a company within a
  -- workspace is its domain, so a second discovery of the same company updates
  -- rather than duplicating.
  domain text check (domain is null or domain = lower(domain)),
  repository text,
  /*
   * How this company was found, and where to look again.
   *
   * Not decoration: a discovery whose source cannot be re-opened cannot be
   * checked, and an unfalsifiable prospect list is how a system starts
   * believing itself.
   */
  discovered_from public.closer_evidence_source not null,
  discovered_url text,
  -- Free-form, small, and never a substitute for evidence rows.
  tech_stack text[] not null default '{}',
  locales text[] not null default '{}',
  employee_estimate int check (employee_estimate is null or employee_estimate > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create index closer_companies_org_idx on public.closer_companies (organization_id);

/* ------------------------------------------------------------------ *
 * Contacts — minimised on purpose.
 * ------------------------------------------------------------------ */

/*
 * Only what a sales conversation needs, and nothing else.
 *
 * There is no field for a personal address, a phone number, a photograph or a
 * social graph, and their absence is the design. GDPR data minimisation is not
 * satisfied by intending to be careful with a column that exists; it is
 * satisfied by the column not existing. `role_title` and a professional email
 * are what an outreach decision rests on.
 *
 * `source_url` is required for the same reason as evidence: a contact nobody
 * can trace to a public page is one nobody can verify was public.
 */
create table public.closer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.closer_companies (id) on delete cascade,
  full_name text check (full_name is null or length(trim(full_name)) between 1 and 200),
  role_title text,
  email text check (email is null or email = lower(email)),
  source public.closer_evidence_source not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index closer_contacts_company_idx on public.closer_contacts (company_id);

/* ------------------------------------------------------------------ *
 * Evidence — every fact, with where it came from and when.
 * ------------------------------------------------------------------ */

create table public.closer_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.closer_companies (id) on delete cascade,
  kind public.closer_evidence_kind not null,
  /*
   * A short machine label — 'i18next', 'translation_pr_frequency',
   * 'hiring_localization'. Kept as text rather than an enum because the set of
   * things worth noticing is expected to grow, and a migration per new signal
   * would make the system slower to learn than the market moves.
   */
  label text not null check (length(trim(label)) between 1 and 80),
  -- What was actually observed, in words a human can check against the source.
  summary text not null check (length(trim(summary)) between 1 and 2000),
  source public.closer_evidence_source not null,
  source_url text not null,
  /*
   * When the thing was observed in the world, not when the row was written.
   *
   * A signal from a repository last touched in 2019 and one from last week
   * carry different weight, and only this column can tell them apart.
   */
  observed_at timestamptz not null,
  /*
   * How sure the extractor is that this observation is what it says it is.
   * Null for a fact read directly (a dependency is in a manifest or it is not);
   * populated when a model inferred it.
   */
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create index closer_evidence_company_idx on public.closer_evidence (company_id, kind);

/* ------------------------------------------------------------------ *
 * Leads — the funnel carrier. One per company per workspace.
 * ------------------------------------------------------------------ */

create table public.closer_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.closer_companies (id) on delete cascade,
  -- The contact this lead is being worked through, once one is chosen.
  contact_id uuid references public.closer_contacts (id) on delete set null,
  /*
   * Never written directly. `closer_set_stage` is the only writer, and it
   * refuses an edge the transition table does not contain — see the companion
   * migration. A column a client can set is a funnel that means nothing.
   */
  stage public.closer_stage not null default 'discovered',
  stage_changed_at timestamptz not null default now(),
  /*
   * What the operator should do next, in their own words or the system's.
   * Nullable because "nothing, wait" is a real answer and inventing a task to
   * fill a column is how a queue fills with noise.
   */
  next_action text,
  next_action_due timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, company_id)
);

create index closer_leads_stage_idx on public.closer_leads (organization_id, stage);

/* ------------------------------------------------------------------ *
 * Stage history — every transition, kept.
 * ------------------------------------------------------------------ */

create table public.closer_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.closer_leads (id) on delete cascade,
  -- Null on the first row: a lead enters the world at `discovered`.
  from_stage public.closer_stage,
  to_stage public.closer_stage not null,
  /*
   * Who moved it. Null means an agent did, and `reason` then carries which one.
   * Distinguishing the two is what makes "what did Closer do, and why" a
   * question the database can answer.
   */
  actor uuid references auth.users (id) on delete set null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index closer_stage_history_lead_idx on public.closer_stage_history (lead_id, created_at desc);

/* ------------------------------------------------------------------ *
 * Scores — explainable, or not stored.
 * ------------------------------------------------------------------ */

create table public.closer_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.closer_companies (id) on delete cascade,
  kind public.closer_score_kind not null,
  value int not null check (value between 0 and 100),
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  /*
   * The per-component arithmetic that produced `value`, as
   * `[{ "component": "locale_count", "points": 15, "max": 15, "why": "..." }]`.
   *
   * Required, and non-empty. A score without its breakdown is the "AI magic"
   * this system is specified not to be: a number nobody can argue with is a
   * number nobody should act on. The check is structural — that it is a
   * non-empty array — because SQL cannot check that the reasoning is honest,
   * only that it was written down.
   */
  breakdown jsonb not null check (
    jsonb_typeof(breakdown) = 'array' and jsonb_array_length(breakdown) > 0
  ),
  -- The weights in force when this was computed, so an old score stays readable
  -- after the weights change.
  weights jsonb not null,
  computed_at timestamptz not null default now(),
  unique (company_id, kind, computed_at)
);

create index closer_scores_company_idx on public.closer_scores (company_id, kind, computed_at desc);

/* ------------------------------------------------------------------ *
 * Suppression — the list that outranks everything.
 * ------------------------------------------------------------------ */

/*
 * A domain or an address that must never be contacted.
 *
 * Deliberately not a boolean on the company: suppression has to survive the
 * company row being deleted and rediscovered tomorrow by a discovery agent that
 * has no memory of yesterday. Keyed on the identifier rather than the entity is
 * what makes "never" mean never.
 */
create table public.closer_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Exactly one of these. Enforced below.
  domain text check (domain is null or domain = lower(domain)),
  email text check (email is null or email = lower(email)),
  reason public.closer_suppression_reason not null,
  note text,
  created_at timestamptz not null default now(),
  constraint closer_suppressions_one_identifier check (
    (domain is not null and email is null) or (domain is null and email is not null)
  )
);

create unique index closer_suppressions_domain_idx
  on public.closer_suppressions (organization_id, domain) where domain is not null;
create unique index closer_suppressions_email_idx
  on public.closer_suppressions (organization_id, email) where email is not null;

/* ------------------------------------------------------------------ *
 * Jobs — asynchronous work, because nothing here fits in a request.
 * ------------------------------------------------------------------ */

/*
 * A queue in Postgres rather than a third-party service.
 *
 * The repository has no job infrastructure at all — runs execute inside the
 * request and nothing resumes one whose request died. Closer cannot work that
 * way: analysing a repository, researching a company and scoring it are minutes
 * of work each.
 *
 * Postgres because the alternative adds a processor outside the EU, and
 * invariant 5 is not something to spend on a queue. `claimed_at` plus a
 * `for update skip locked` claim in the RPC is enough for one worker pulled by
 * a cron; it is not enough for many, and that limit is written down rather than
 * discovered later.
 */
create table public.closer_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (length(trim(kind)) between 1 and 60),
  -- What the job needs. Validated by the handler, not here.
  payload jsonb not null default '{}'::jsonb,
  state public.closer_job_state not null default 'queued',
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts >= 1),
  run_after timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- The claim query's index: queued work whose time has come, oldest first.
create index closer_jobs_claimable_idx
  on public.closer_jobs (state, run_after)
  where state = 'queued';

/* ------------------------------------------------------------------ *
 * AI executions — what the model was asked, and what it answered.
 * ------------------------------------------------------------------ */

/*
 * The audit trail that makes "why did Closer do that" answerable.
 *
 * Stores the prompt's inputs rather than the rendered prompt: the rendered text
 * is reconstructible from the inputs and the version, and storing it would
 * duplicate every piece of external content into a second place that also has
 * to be protected.
 */
create table public.closer_ai_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.closer_companies (id) on delete set null,
  agent text not null check (length(trim(agent)) between 1 and 60),
  model_id text not null,
  input jsonb not null,
  output jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  input_tokens int,
  output_tokens int,
  latency_ms int,
  -- Populated when the call failed or its output failed validation. Both are
  -- outcomes worth keeping: a model that returns unparseable JSON on a
  -- particular shape of input is a fact about the system.
  error text,
  created_at timestamptz not null default now()
);

create index closer_ai_executions_org_idx
  on public.closer_ai_executions (organization_id, created_at desc);

/* ------------------------------------------------------------------ *
 * Row-level security.
 * ------------------------------------------------------------------ */

/*
 * Read for members; no client writes at all.
 *
 * Every table below gets a SELECT policy and nothing else, which is the same
 * shape `runs` uses and for the same reason: the write path is a definer
 * function that checks membership and validates the transition. A table with an
 * INSERT policy is a table an agent can write to freely, and "do not allow every
 * agent to mutate everything" is a property of the schema or it is a hope.
 */
alter table public.closer_companies enable row level security;
alter table public.closer_contacts enable row level security;
alter table public.closer_evidence enable row level security;
alter table public.closer_leads enable row level security;
alter table public.closer_stage_history enable row level security;
alter table public.closer_scores enable row level security;
alter table public.closer_suppressions enable row level security;
alter table public.closer_jobs enable row level security;
alter table public.closer_ai_executions enable row level security;

create policy closer_companies_select on public.closer_companies
  for select using (public.is_org_member(organization_id));
create policy closer_contacts_select on public.closer_contacts
  for select using (public.is_org_member(organization_id));
create policy closer_evidence_select on public.closer_evidence
  for select using (public.is_org_member(organization_id));
create policy closer_leads_select on public.closer_leads
  for select using (public.is_org_member(organization_id));
create policy closer_stage_history_select on public.closer_stage_history
  for select using (public.is_org_member(organization_id));
create policy closer_scores_select on public.closer_scores
  for select using (public.is_org_member(organization_id));
create policy closer_suppressions_select on public.closer_suppressions
  for select using (public.is_org_member(organization_id));
create policy closer_jobs_select on public.closer_jobs
  for select using (public.is_org_member(organization_id));
create policy closer_ai_executions_select on public.closer_ai_executions
  for select using (public.is_org_member(organization_id));
