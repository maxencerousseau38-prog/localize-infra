-- Seed integrity proof: the fixture contains no state the product cannot reach.
--
-- A fixture is a claim about what this system produces. When it contains a row
-- the application refuses to create, every screen reading that row reports
-- something impossible — and the reader blames the screen, which is the one
-- part that was telling the truth.
--
-- That happened. `/acceptance/projects` showed "Repository connected 0" beside
-- "Runs started 3" and "Pull requests opened 1", and the funnel was correct on
-- every line: the seed had called `public.start_run` directly against a project
-- with no `repository_owner`. The SQL function has no such guard, deliberately
-- — the guard lives in `startRun` (apps/web/.../run-actions.ts), which returns
-- 'Connect a repository before running.' before it ever calls down. So the seed
-- had walked around the only check there is.
--
-- It was found by opening the page, not by reading the file, and nothing in
-- this repository could have found it any other way. Unit tests read the app,
-- the end-to-end suite reads the seeded rows and believes them, and the
-- database is free to hold whatever SQL puts there. This file is the layer that
-- can see it, so this is where it goes.
--
-- Read-only, unlike its neighbours: the others build a scenario and roll it
-- back, this one interrogates what `supabase db reset` already loaded. The
-- deliberate raise at the end is still required — run.sh reads the verdict from
-- the exception message, not from the exit code.
do $$
declare
  r text := '';
  n int;
begin
  -- 1. No run belongs to a project with no repository.
  --
  -- The invariant, stated the way the product states it. `startRun` checks
  -- `repository_owner` and `repository_name` together; the schema's
  -- `projects_repository_is_whole` guarantees they travel with
  -- `repository_connected_at`, so testing one is testing the set.
  select count(*) into n
    from public.runs run
    join public.projects p on p.id = run.project_id
   where p.repository_owner is null;
  r := r || format('runs-on-repoless-project=%s(want 0); ', n);

  -- 2. No pull request points at a repository the project does not claim.
  --
  -- The seeded PR URL named `maxencerousseau38-prog/localize-infra-fixture-vite`
  -- while the project named nothing at all. A URL and a pointer that disagree
  -- are the same defect one field along, and cheaper to check than to explain.
  -- `coalesce`, and it is not decoration. Written without it, the comparison
  -- concatenates a NULL owner into a NULL pattern, `x not like NULL` is NULL,
  -- and the row is not counted — so this check passed cleanly against the very
  -- state it exists to catch. Verified: with the repository nulled out, it read
  -- 0 while check 1 read 3. That is the same shape as the `not in` guard on a
  -- nullable role recorded in CLAUDE.md, which let through exactly the callers
  -- it was written to stop.
  --
  -- The empty string can never prefix a real GitHub URL, so a run with a pull
  -- request on a project claiming no repository is now counted here as well as
  -- above, and the two checks stop depending on each other.
  select count(*) into n
    from public.runs run
    join public.projects p on p.id = run.project_id
   where run.pr_url is not null
     and run.pr_url not like
         'https://github.com/' || coalesce(p.repository_owner, '')
         || '/' || coalesce(p.repository_name, '') || '/%';
  r := r || format('pr-url-disagrees-with-project=%s(want 0); ', n);

  -- 3. No run predates the connection that made it possible.
  --
  -- Not pedantry: `repository_connected_at` is what the product writes at
  -- connect time, so a run older than it describes a run that started before
  -- the repository existed. The seed backdates its runs by two to three hours
  -- and connects at four, which is the only reason this passes.
  select count(*) into n
    from public.runs run
    join public.projects p on p.id = run.project_id
   where p.repository_connected_at is not null
     and run.created_at < p.repository_connected_at;
  r := r || format('runs-before-connection=%s(want 0); ', n);

  -- 4. A project with no repository and no runs is still expected.
  --
  -- The guard above is satisfied trivially by connecting every project, which
  -- would delete a state the product produces constantly — create a project,
  -- connect GitHub later — and leave the fixture unable to exercise it. So the
  -- absence is asserted too. 'languages' is that project.
  select count(*) into n
    from public.projects p
   where p.repository_owner is null
     and not exists (select 1 from public.runs run where run.project_id = p.id);
  r := r || format('repoless-projects-without-runs=%s(want 2); ', n);

  -- 5. The seed still holds the runs the suite counts.
  --
  -- Without this the four checks above all pass on an empty database, which is
  -- the vacuous-proof failure this directory has already shipped once: run.sh
  -- reported "ok — 7 check(s)" while silently skipping the assertions that
  -- mattered. A guard that can pass against nothing is not a guard.
  select count(*) into n from public.runs;
  r := r || format('seeded-runs=%s(want 3); ', n);

  raise exception 'SEED-INTEGRITY >> %', r;
end $$;
