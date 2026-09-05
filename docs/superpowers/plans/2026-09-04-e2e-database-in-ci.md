# End-to-end tests against a database, in CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 48 end-to-end tests that read real rows run on every pull request, against a database that is created and destroyed inside the job.

**Architecture:** The CI job starts the Supabase stack locally with the CLI — Postgres, GoTrue and PostgREST in containers on the runner — applies `supabase/migrations` and `supabase/seeds/dev-user.sql` to it, and exports its address and anon key into the job environment. Playwright's third web server (port 3212) inherits that environment, the three database-dependent specs stop skipping themselves, and everything is thrown away when the job ends.

**Tech Stack:** GitHub Actions (ubuntu-latest, Docker preinstalled), Supabase CLI 2.116.0, Playwright, Next.js.

## Global Constraints

- **Nothing in CI may touch a hosted Supabase project.** Not production (`ijgheekdihgssktyweyy`), not development (`aguwalokxfgtqbzmdjbs`). The reason is not only blast radius: the suites mutate rows, `fullyParallel` is on, and two concurrent pull requests against one shared database is the race this repository has already been bitten by at test level.
- **No GitHub secret is to be added.** The local stack's keys are fixed and public by design. If a step seems to need a secret, that step is wrong.
- **`master` refuses direct pushes.** Branch, pull request, `test` and `e2e` green, then merge.
- **Run `npm run gates`** — lint → typecheck → test → test:e2e. All four.
- **Kill ports 3210/3211/3212 before any local e2e campaign.** A surviving `next start` answers with stale code, and the symptom is a pass.
- The Supabase organisation is on the **free plan** with both project slots taken. Creating a third hosted project is not an available option and must not be attempted.
- Do not renumber, reorder or edit existing files in `supabase/migrations/`. They are applied to two live databases; this plan only replays them.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `supabase/config.toml` | Local stack configuration: ports, and which SQL files seed a reset | Create (via `supabase init`) |
| `package.json` (root) | The `supabase` CLI as a pinned devDependency, and a script that prepares a local database | Modify |
| `.github/workflows/ci.yml` | The `e2e` job starts the stack, seeds it, exports its env | Modify |
| `.gitignore` | Whatever `supabase init` adds beside `.temp/` | Modify if needed |
| `docs/superpowers/plans/2026-09-04-e2e-database-in-ci.md` | This plan | Created |

No test file changes. The three specs already do the right thing — they skip when there is no database and run when there is one. Making them run is a matter of giving them one, and if any spec needs editing to pass, that is a finding about the spec, not a step in this plan.

---

### Task 1: A local stack that this repository can start

**Files:**
- Create: `supabase/config.toml`
- Modify: `package.json` (root — devDependency and script)
- Modify: `.gitignore` (only if `supabase init` writes new scratch paths)

**Interfaces:**
- Produces: `npm run db:local` — brings up a local stack with every migration and the seed applied, idempotent enough to re-run.
- Produces: `supabase status -o env` emitting `API_URL` and `ANON_KEY`, which Task 2 maps onto `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Pin the CLI as a devDependency**

The CI job must not resolve `@latest` — a CLI that changes under the repository is a build whose behaviour changes without a commit.

```bash
npm install --save-dev --save-exact supabase@2.116.0
```

Expected: root `package.json` gains `"supabase": "2.116.0"` under `devDependencies`.

**The lockfile that this writes is the trap this repository has already paid five days for.** `npm install` on Windows prunes platform-specific optional packages. Check the diff before committing:

```bash
git diff --stat package-lock.json
```

If it shows more than the `supabase` addition — if `@rollup/rollup-linux-*` or `@esbuild/linux-*` entries disappear — stop and regenerate the lockfile on Linux instead. Do not commit a pruned lockfile.

- [ ] **Step 2: Initialise the local configuration**

```bash
npx supabase init
```

Expected: `supabase/config.toml` created. `supabase init` refuses if the file exists; that is fine and means this step is done.

- [ ] **Step 3: Point the seed at this repository's seed file**

`supabase db reset` applies every file in `supabase/migrations/` in filename order, then whatever `config.toml` names as seed SQL. This repository keeps its seed at `supabase/seeds/dev-user.sql`, which is not the default path.

Open `supabase/config.toml`, find the `[db.seed]` section, and set it so the reset applies that file. Confirm the exact key names against the generated file rather than from memory — the CLI has renamed them across versions.

Add a comment above it saying why the path is non-standard: the seed is also applied by hand to the development database and is written to be run on its own.

- [ ] **Step 4: Add the script**

In root `package.json` scripts:

```json
"db:local": "supabase start && supabase db reset"
```

`start` is idempotent — it reports an already-running stack and exits 0. `db reset` is what makes a second run meaningful: it drops, re-applies every migration, and re-seeds.

- [ ] **Step 5: Run it, and read what it says**

```bash
npm run db:local
```

Expected: Docker images pull on the first run (several minutes), then every migration applies in order and the seed runs.

**This is the first time `supabase/migrations` has ever been replayed from an empty database.** Both hosted databases were built by applying migrations one at a time through the MCP tool, and their recorded versions do not match these filenames. A failure here is a real finding about the sequence, not a problem with this plan — record what fails and stop rather than editing a migration to make it pass.

> **Steps 5 and 6 were deferred on 2026-09-04: Docker is not installed on the
> development machine, so `supabase start` cannot run there.** They move to the
> first CI run, which is a Docker-capable environment and where a failure is a
> red check on a pull request rather than a surprise later.
>
> What was done instead, and it removes the larger half of the risk: the
> filename order of `supabase/migrations` was compared against the order the 33
> migrations were actually applied in on production. **They are identical** — 33
> files, 33 recorded migrations, no divergence. A replay by filename therefore
> follows the sequence that is known to have worked. What remains unproven is
> whether any migration depends on state that was placed by hand rather than by
> an earlier migration, which only an empty-database reset can answer.

- [ ] **Step 6: Verify the stack holds what the tests expect**

```bash
npx supabase status -o env
```

Expected: `API_URL` and `ANON_KEY` among the output.

Then, against the local database, confirm the seed produced what the suites read:

```sql
select count(*) from auth.users;                      -- expect 2
select count(*) from public.runs;                     -- expect 3
select status from public.runs order by created_at;   -- no_changes, succeeded, awaiting_review
select slug from public.organizations order by slug;  -- acceptance, intruder-co
```

The run count is load-bearing: `data-surface.spec.ts` asserts "3 runs" and three table rows.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml package.json package-lock.json .gitignore
git commit -m "build: a local Supabase stack this repository can start"
```

---

### Task 2: The e2e job runs against it

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run db:local` and `supabase status -o env` from Task 1.
- Produces: an `e2e` job in which `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set for both the Playwright process and the servers it starts.

- [ ] **Step 1: Add the database steps to the `e2e` job**

Between `npm ci` and the Playwright install, in `.github/workflows/ci.yml`:

```yaml
      # The database these tests read is created here and dies with the job.
      #
      # Deliberately not a hosted project. The suites mutate rows and
      # `fullyParallel` is on, so two pull requests sharing one database would
      # race — the same failure this repository already fixed at test level by
      # giving one spec its own project. A per-run stack removes the shared
      # resource instead of scheduling around it.
      #
      # No secret is involved: the local stack's keys are fixed and public by
      # design. A step here that needs a secret is a step that is wrong.
      - run: npm run db:local

      # Exported for the whole job, which reaches two places that both need it:
      # playwright.config.ts reads SUPABASE_URL when it decides whether the
      # database-dependent specs skip, and the port 3212 server inherits the
      # ambient environment. Ports 3210 and 3211 are unaffected — 3211 is
      # started with the variables blanked on purpose.
      - name: Export the local stack's address
        run: |
          npx supabase status -o env >> "$GITHUB_ENV"
          {
            echo "SUPABASE_URL=$(npx supabase status -o env | grep '^API_URL=' | cut -d= -f2- | tr -d '\"')"
            echo "SUPABASE_PUBLISHABLE_KEY=$(npx supabase status -o env | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '\"')"
          } >> "$GITHUB_ENV"
```

Confirm the exact variable names `supabase status -o env` emits before relying on them — Step 6 of Task 1 printed them. If they differ from `API_URL`/`ANON_KEY`, use what it actually prints and say so in the commit message.

- [ ] **Step 2: Push the branch and read the run**

The only way to test a workflow change is to run it.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the end-to-end suite against a database"
git push
```

- [ ] **Step 3: Verify the tests ran rather than passed**

```bash
gh run view --log | grep -E "passed|skipped"
```

Expected: the web suite reports **114 passed and 0 skipped**, against 66 passed and 48 skipped before this change.

**A green job is not the result.** It was already green with all 48 skipped, which is exactly how this gap survived. The number that matters is the skip count reaching zero; if the job is green and the skip count is still 48, the environment did not reach the test process and the change achieved nothing.

- [ ] **Step 4: Confirm no hosted database was touched**

```sql
-- against ijgheekdihgssktyweyy, then aguwalokxfgtqbzmdjbs
select count(*) as runs, max(created_at) as dernier from public.runs;
```

Expected: unchanged from before the run — production 8 runs, development 3. A CI job that reached a hosted database would show new rows, and that is the failure this whole design exists to prevent.

---

### Task 3: The RLS assertions that nothing runs

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/product/11-mvp-scorecard.md`

> **Corrected on 2026-09-05: these are not pgTAP tests, and `supabase test db`
> would not have run them.** Each is a single `do $$ … $$` block that builds a
> verdict string and ends with a deliberate `raise exception`, so the
> transaction rolls back — which means every one of them exits non-zero on
> success. The exit code proves nothing and neither does the marker, since a
> script that aborts early also exits non-zero without reaching its raise.
> `supabase/tests/run.sh` reads the verdict and compares each check against what
> it wanted, and fails on a missing verdict line.

`supabase/tests/tenant-isolation.sql` and `supabase/tests/closer-suppression.sql` are database proofs that nothing executes — not CI, not a script, not a documented command. `docs/product/11-mvp-scorecard.md` cites the first as what "asserts RLS isolation". It asserts nothing while nothing runs it.

Task 1 makes them runnable at no extra cost: `supabase test db` runs pgTAP against the stack that is already up.

- [ ] **Step 1: Run them locally first**

```bash
npm run db:local
npx supabase test db
```

Expected: both files run. If they fail, that is a finding about RLS or about the tests, and it belongs in its own change — record it and stop. Do not weaken a test to make this task green.

- [ ] **Step 2: Add the step to the `e2e` job**

After `npm run db:local`:

```yaml
      # pgTAP, against the same stack. These two files existed and ran nowhere
      # while 11-mvp-scorecard.md cited them as the evidence for tenant
      # isolation — an assertion whose only reader was the document naming it.
      - run: npx supabase test db
```

- [ ] **Step 3: Correct the scorecard**

`docs/product/11-mvp-scorecard.md` line 47 credits `supabase/tests/tenant-isolation.sql` with asserting RLS isolation. Add, in the register of that file, that it is executed on every pull request as of this change — and that it was not before.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml docs/product/11-mvp-scorecard.md
git commit -m "ci: run the pgTAP tests that nothing was running"
```

---

### Task 4: Say what changed, and what did not

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Record it**

`CLAUDE.md` describes the gates and the two Supabase projects. Add, in its register:

- 48 end-to-end tests read real rows and now run on every pull request, against a stack created and destroyed inside the job;
- the stack is local and per-run, so no hosted database is reachable from CI and no secret was added — and why that is isolation rather than convenience;
- `supabase/migrations` is replayed from empty on every run, which is the first continuous proof that the sequence is replayable — both hosted databases were built one migration at a time and had never been rebuilt;
- what is still not covered, honestly: the suites exercise seeded rows, not the GitHub or model paths, which stay manual.

- [ ] **Step 2: Full gates, then the pull request**

```bash
npx kill-port 3210 3211 3212
npm run gates
gh pr create --fill
gh pr checks --watch
```

---

## Self-Review

**Coverage.** The audit named five gaps: the workflow has no database (Task 2), no local stack exists (Task 1), the free plan blocks a third hosted project (avoided by design, stated in Global Constraints), the seed needs privileged SQL (Task 1 Step 3, via `db reset` rather than a client), and GoTrue is required rather than bare Postgres (the CLI stack provides it — the reason it is the CLI and not a `postgres:17` service). The pgTAP files were found during the audit and are Task 3.

**The risk this plan does not remove.** Task 1 Step 5 replays every migration from empty for the first time. If the sequence is not replayable, this plan stops there with a real finding, and the CI work waits on a separate fix. That is the honest order: a plan that edited migrations to make a reset pass would be repairing the evidence.

**What would make this plan wrong.** If `supabase status -o env` emits different variable names than Task 2 assumes, Step 1 of Task 2 is wrong in detail — which is why Task 1 Step 6 prints them first and Task 2 Step 1 says to confirm before relying on them. And if the runner cannot start Docker containers, the whole approach fails and the fallback is a hosted project, which the Global Constraints forbid — that fallback would need a decision, not a workaround.
