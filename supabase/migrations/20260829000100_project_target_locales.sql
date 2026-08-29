-- The languages a project translates into, constrained for the first time.
--
-- `target_locales` has existed since the tenancy migration with
-- `not null default '{}'` and no check at all. That was survivable only because
-- nothing ever wrote to it: `createProject` inserted four columns and this was
-- not one of them, so every project in the product had an empty list and every
-- run over one iterated its locale loop zero times.
--
-- Now that a person can type into it, the value reaches three places that each
-- care: a locale *filename* on a case-sensitive filesystem, one model call per
-- entry inside a single request, and a pull request whose title lists them.
--
-- The application validates first, in `parseTargetLocales` (packages/schemas),
-- because only it can explain a refusal in a sentence. This constraint accepts
-- exactly what that function emits — no more, so nothing unusable is stored;
-- no less, so a legal value never dies here with a raw constraint error.

-- An immutable helper rather than an inline expression: a CHECK cannot contain
-- a subquery, and duplicate detection needs one. Immutability is what makes it
-- legal in a constraint, and true here — it reads only its arguments.
create or replace function public.target_locales_are_valid(
  locales text[],
  source_locale text
) returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select
    -- Empty is valid: it means a project that translates into nothing yet,
    -- which is what every project had before this column could be written.
    cardinality(locales) = 0
    or (
      -- One model call per locale, in the request that started the run, with
      -- no worker to resume it past the serverless timeout.
      cardinality(locales) <= 20

      -- Shape, per element. Same expression as the `source_locale` check on
      -- this table: two ideas of what a locale looks like would let a value
      -- pass one and fail the other.
      --
      -- The first version of this joined the array with commas and matched a
      -- comma-separated pattern, to avoid a subquery. It accepted the single
      -- element 'fr,de' — one string containing a comma — because joining a
      -- one-element array produces exactly that. The premise was wrong anyway:
      -- a CHECK cannot hold a subquery, but this function's body can, which is
      -- the whole reason the function exists. Caught by inserting the value,
      -- not by reading the expression.
      and not exists (
        select 1 from unnest(locales) as l
        where l !~ '^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$'
      )

      -- No duplicates. Two entries for one language mean two model calls and
      -- one file written twice.
      and cardinality(locales) = (
        select count(distinct lower(l)) from unnest(locales) as l
      )

      -- The source is where the strings come from. Translating a language into
      -- itself would overwrite the catalogue the same run just extracted.
      and not (lower(source_locale) = any (
        select lower(l) from unnest(locales) as l
      ))
    );
$$;

comment on function public.target_locales_are_valid is
  'Accepts exactly what parseTargetLocales (packages/schemas) emits. Immutable so it can be used in a CHECK constraint, which cannot hold a subquery.';

alter table public.projects
  add constraint projects_target_locales_are_valid
  check (public.target_locales_are_valid(target_locales, source_locale));
