-- Where inside the repository the project actually lives.
--
-- `detectFramework` and `extractFromProject` have always run at the root of the
-- checkout. That works for a repository that is one application and fails for
-- every monorepo, and it fails *correctly* — "No supported framework detected"
-- — which is a wall with no door. The shape is extremely common; this
-- repository is itself one, with two Next applications two levels down.
--
-- Null means the repository root, which is what every project has today and
-- what an empty field means. A nullable column rather than a default of '.':
-- '.' and '' and null would be three spellings of one thing, and the reader
-- downstream would have to normalise all three.
alter table public.projects
  add column root_dir text;

-- The application is the real validator — `normaliseRootDir` in packages/core,
-- which explains each refusal in words to the person who typed the value. This
-- constraint exists so a value that never passed through it cannot be stored,
-- and it is written to accept **exactly** what that function emits: no more, so
-- nothing unsafe lands; no less, so a legal value never dies here with a raw
-- constraint error instead of a sentence.
--
-- What each clause stops, none of it about tidiness:
--   `..`    escapes the checkout when reading and the repository when writing.
--           This is the whole reason both the function and this check exist.
--   `.`     harmless, but it makes two spellings of one location.
--   `/…`    a leading slash reaches the filesystem root through join().
--   `…/`    and `//` produce an empty segment, which is the same ambiguity.
--   `C:`    a Windows drive letter is absolute the same way.
--   `\`     never survives normalisation, so its presence proves the value
--           bypassed it.
--
-- A NUL byte needs no clause: postgres `text` cannot hold one at all.
alter table public.projects
  add constraint projects_root_dir_is_a_safe_subdirectory
  check (
    root_dir is null
    or (
      length(root_dir) between 1 and 200
      and root_dir !~ '^/'
      and root_dir !~ '/$'
      and root_dir !~ '//'
      and root_dir !~ '(^|/)[.][.]?($|/)'
      and root_dir !~ '^[A-Za-z]:'
      and strpos(root_dir, '\') = 0
    )
  );

comment on column public.projects.root_dir is
  'Subdirectory the project lives in, relative to the repository root. Null means the repository root itself. Normalised by normaliseRootDir (packages/core) before it is stored.';

-- Corrected while here, because it describes a gate that no longer exists and
-- an installation model that was replaced.
--
-- It read: "Set only through the operator-gated connection flow while the
-- product uses a single shared App installation." Both halves are false.
-- `GITHUB_OPERATOR_EMAILS` and `isOperator` are gone — they had no callers at
-- all — and the installation is per-organization since
-- 20260817000600. A comment asserting a check that does not exist is a defect
-- this repository has now shipped four times; leaving a fifth in place while
-- editing the same table would be a choice.
comment on column public.projects.repository_owner is
  'GitHub owner. Set through the connection flow, which authorizes by asking whether the workspace''s own App installation can reach the repository.';
