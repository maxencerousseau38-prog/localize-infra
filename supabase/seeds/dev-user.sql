-- A confirmed development user, for authenticated end-to-end runs.
--
-- NOT for production. It sets a known password, which is exactly what makes it
-- useful locally and unacceptable anywhere real. Nothing applies this
-- automatically; run it by hand against a development database.
--
-- Why a seed rather than a signup: Supabase requires email confirmation and
-- there is no inbox in a test run. GoTrue also rejects reserved TLDs, so
-- `.test` and `.invalid` addresses fail validation at signup — hence a
-- registrable-looking domain and a direct insert.
--
-- Every column GoTrue expects is written explicitly. Leaving the token columns
-- NULL produces a row that looks correct in psql and then fails the password
-- grant with "Invalid login credentials", which costs an hour to diagnose.

-- "NOT for production" used to be a sentence in a comment, and a sentence in a
-- comment does not stop anything. It did not stop this: while production and
-- development shared one Supabase project, this account authenticated against
-- the public deployment, and the file saying it should not still sat right
-- here. The two databases are now separate, and the rule is enforced rather
-- than written down.
--
-- The production database is stamped out of band, not by a migration —
-- migrations replay into development too, so a marker created by one could not
-- tell the two apart:
--
--   comment on database postgres is 'localize-infra-production';
--
-- A database with no stamp is assumed to be development, which is the safe
-- default: a forgotten stamp costs a refused seed on a real database only if
-- someone also forgot to stamp it, whereas the reverse default would let an
-- unstamped production database be seeded silently.
do $$
begin
  if coalesce(
       shobj_description(
         (select oid from pg_database where datname = current_database()),
         'pg_database'),
       '') = 'localize-infra-production'
  then
    raise exception
      'refusing to seed: this database is stamped as production (%). This seed writes a password that is committed to the repository.',
      current_database();
  end if;
end $$;

-- Clear a previous application of this seed, workspace first.
--
-- `delete from auth.users` alone was here, and it made the file single-use:
-- `organizations.created_by` references `auth.users` ON DELETE **RESTRICT**, so
-- the moment this seed had created a workspace, re-running it aborted at this
-- line with a foreign key violation. Nothing said so — the failure named
-- `organizations_created_by_fkey`, several statements away from the workspace
-- it was actually protecting, and the file that appeared to reset the fixture
-- reset nothing.
--
-- Deleting the organization first satisfies the restrict, and it cascades to
-- projects, runs, translations, ambiguities, members and entitlements — every
-- row this file goes on to create. By slug rather than by owner, because the
-- slug is what this seed claims and what `create_organization` would collide
-- with below.
--
-- Both deletes run as the seed's own role. They would be silent no-ops as
-- `authenticated`: these tables grant SELECT to members and no DELETE at all,
-- so RLS discards the statement without raising, and the fixture then looks
-- applied while carrying rows from every previous run.
delete from public.organizations where slug = 'acceptance';
delete from auth.users where email = 'acceptance@localize-infra.dev';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at,
  email_change_token_new, email_change, email_change_sent_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
  email_change_token_current, email_change_confirm_status,
  banned_until, reauthentication_token, reauthentication_sent_at,
  is_sso_user, deleted_at, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'acceptance@localize-infra.dev', crypt('acceptance-test-pw-8chars', gen_salt('bf')), now(),
  null, '', null,
  '', null,
  '', '', null,
  null, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, now(), now(),
  null, null, '', '', null,
  '', 0,
  null, '', null,
  false, null, false
);

-- A workspace and a project for the authenticated end-to-end suite to read.
--
-- Fixtures rather than test-created data: a suite that creates a workspace on
-- every run accumulates rows in a shared database and starts failing on the
-- unique slug the second time. These are created by the seed and asserted
-- against — recreated from scratch on each application, which is what the
-- cascade above buys and what makes the suite's counts mean something.
--
-- create_organization() is called as the seeded user by setting the JWT claim,
-- which is also the only way to exercise the same path the application uses.
do $$
declare
  uid uuid;
  org public.organizations;
begin
  select id into uid from auth.users where email = 'acceptance@localize-infra.dev';

  -- Claims must be set before the role switch; afterwards the GUC is no longer
  -- settable and auth.uid() stays null.
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  org := public.create_organization('Acceptance', 'acceptance');

  insert into public.projects (organization_id, name, slug, source_locale, target_locales)
  values (org.id, 'Demo', 'demo', 'en', array['fr','de']);

  perform set_config('role','postgres',true);
end $$;

-- Two runs, so the authenticated suite has rows to assert over.
--
-- Everything above this point gave the suite a workspace and a project; there
-- was still nothing a run produced, so the data-surface contract (DESIGN.md §8:
-- a result count, a filter, sortable columns, a designed empty state) and every
-- run-detail assertion were skipped for want of a fixture rather than because
-- they were wrong.
--
-- Two rather than one, because the interesting assertions are about telling
-- states apart:
--
--   * a succeeded run, with a pull request, timing and per-locale proposals —
--     the history a customer reads after the fact;
--   * a run stopped at `awaiting_review` with an unanswered question — the
--     state the whole escalation gate exists to produce, and the one /review
--     and /ambiguity read.
--
-- Written through the same RPCs the application calls, as the seeded user, so
-- the fixture exercises the real path including its membership checks. Rows
-- inserted directly would be a shape the product cannot actually produce, which
-- is the failure mode the sample data had.
do $$
declare
  uid uuid;
  proj public.projects;
  finished public.runs;
  waiting public.runs;
begin
  select id into uid from auth.users where email = 'acceptance@localize-infra.dev';
  select p.* into proj
    from public.projects p
    join public.organizations o on o.id = p.organization_id
   where o.slug = 'acceptance' and p.slug = 'demo';

  -- No delete here. The project is created fresh above, by a `create_organization`
  -- that the file's opening cascade guarantees is the only one — so the suite's
  -- "2 runs" is true because these are the only two runs the project has ever
  -- had, not because something cleaned up after a previous pass.
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);

  -- 1. The run that finished and opened a pull request.
  finished := public.start_run(proj.id);
  perform public.record_run_translations(
    finished.id,
    jsonb_build_array(
      jsonb_build_object('locale','fr','translation_key','app.save','source_text','Save','proposed_text','Enregistrer','origin','model'),
      jsonb_build_object('locale','fr','translation_key','app.cancel','source_text','Cancel','proposed_text','Annuler','origin','model'),
      jsonb_build_object('locale','de','translation_key','app.save','source_text','Save','proposed_text','Speichern','origin','model'),
      jsonb_build_object('locale','de','translation_key','app.cancel','source_text','Cancel','proposed_text','Abbrechen','origin','model')
    ),
    'src/locales'
  );
  perform public.finish_run(
    finished.id, 'succeeded', 'pull_request', 'Vite + React',
    2, 4, 2, 0, null,
    'https://github.com/maxencerousseau38-prog/localize-infra-fixture-vite/pull/1',
    1, 'localize-infra/add-translations-seed'
  );

  -- 2. The run that stopped to ask. `finish_run` with 'awaiting_review' is the
  --    same call the pipeline makes when it raises an escalation.
  waiting := public.start_run(proj.id);
  perform public.record_run_translations(
    waiting.id,
    jsonb_build_array(
      jsonb_build_object('locale','fr','translation_key','app.close','source_text','Close','proposed_text','Fermer','origin','model'),
      jsonb_build_object('locale','de','translation_key','app.close','source_text','Close','proposed_text','Nah','origin','model')
    ),
    'src/locales'
  );
  perform public.record_ambiguity(
    waiting.id, 'app.close', 'de', 'Close', 'Nah',
    'Verb or adjective? German uses different words, and the surrounding code does not disambiguate.',
    jsonb_build_array(
      jsonb_build_object('text','Schließen','rationale','Verb — "to close". Correct if this is a button.'),
      jsonb_build_object('text','Nah','rationale','Adjective — "nearby".')
    )
  );
  perform public.finish_run(
    waiting.id, 'awaiting_review', 'escalate', 'Vite + React',
    1, 2, 2, 0, null, null, null, null
  );

  perform set_config('role','postgres',true);

  -- Give the two runs distinct times, on the owner's side of the switch.
  --
  -- Both were created inside one transaction, and `now()` in Postgres is the
  -- *transaction* start time, not the wall clock — so every column the RPCs
  -- stamped came out byte-identical: both `created_at`, both `started_at`, both
  -- `finished_at`. Two consequences, and neither announced itself:
  --
  --   * /locales reads "the newest run that produced anything" with
  --     `order by created_at desc limit 1`. With a tie Postgres returns
  --     whichever row it likes, so coverage described the succeeded run on one
  --     pass of the suite and the escalated one on the next. A fixture that
  --     changes its mind is worse than no fixture.
  --   * `finished_at - started_at` was zero, so both runs displayed a duration
  --     of `0ms` — a measurement nobody took, presented as one.
  --
  -- Fixed offsets rather than `clock_timestamp()`: relative to the seed, so the
  -- rows never look stale, but the interval between them is a constant, which
  -- is what makes "the newest run" and a stable duration reproducible.
  --
  -- `runs` has no UPDATE policy, so this only works as the owner — the same
  -- reason the delete above sits before the role switch.
  update public.runs
     set created_at  = now() - interval '2 hours',
         started_at  = now() - interval '2 hours',
         finished_at = now() - interval '2 hours' + interval '22.4 seconds'
   where project_id = proj.id and status = 'succeeded';

  update public.runs
     set created_at  = now() - interval '30 minutes',
         started_at  = now() - interval '30 minutes',
         finished_at = now() - interval '30 minutes' + interval '9.7 seconds'
   where project_id = proj.id and status = 'awaiting_review';
end $$;
