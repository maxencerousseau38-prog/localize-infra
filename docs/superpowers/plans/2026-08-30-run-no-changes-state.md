# `no_changes` Run State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A run that finds nothing to translate finishes in an explicit `no_changes` state instead of opening a pull request with an empty commit.

**Architecture:** The run already holds both sides of the comparison in memory — `existing`, read from the checkout of the base branch, and `merged`, just built. A pure `catalogsEqual` in `packages/core` answers "did this file change"; `run-actions.ts` folds that over the source file and every target locale and, when nothing changed, calls `finish_run` with a new terminal status rather than `/v1/open-pr`. No extra network call, no branch created, nothing to clean up.

**Tech Stack:** TypeScript, Next.js App Router (server actions), Supabase/Postgres (enum + plpgsql RPC), Vitest, Playwright.

## Global Constraints

- **Every migration is applied to BOTH Supabase projects**: dev `aguwalokxfgtqbzmdjbs` and prod `ijgheekdihgssktyweyy`. Applying to one is the drift this repository has already recorded.
- **`master` refuses direct pushes** (`enforce_admins` is true). Work on a branch, open a PR, let `test` and `e2e` pass, then merge.
- **Run `npm run gates`** — lint → typecheck → test → test:e2e. All four, not three.
- **Kill ports 3210/3211 before any e2e campaign.** A surviving `next start` answers with stale code.
- **Never invent data in the interface.** A run with nothing to do says so; it does not show a fabricated pull request.
- The five pipeline stage names are fixed (DESIGN.md §1.4). This plan adds a **status**, not a stage.
- `apps/api` and `packages/cli` are **out of scope**. They carry the same flaw; it is recorded as follow-up in Task 5, not fixed here.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `packages/core/src/locale-file/index.ts` | Locale catalog primitives — already home to `pendingKeys` and `mergeTranslations` | Add `catalogsEqual` |
| `packages/core/src/locale-file/index.test.ts` | Their regression tests | Add `catalogsEqual` cases |
| `supabase/migrations/20260830000100_run_status_no_changes.sql` | Adds the enum value, alone | Create |
| `supabase/migrations/20260830000200_finish_run_no_changes_is_final.sql` | Teaches `finish_run` the new status is terminal | Create |
| `apps/web/src/lib/runs/progress.ts` | What a stored run state means to a watcher | Extend `RunStatus` and `RunProgress` |
| `apps/web/src/lib/runs/progress.test.ts` | Its tests | Add cases |
| `apps/web/src/lib/data/workspace.ts` | The `RunStatus` union the data layer exposes | Extend |
| `apps/web/src/components/runs-table.tsx` | `/runs` list — status union, `STATE` map, filters | Extend |
| `apps/web/src/app/[org]/projects/[project]/runs-section.tsx` | Project page run list — status union, `STATUS` map | Extend |
| `apps/web/src/app/[org]/projects/[project]/run-actions.ts` | The pipeline | Add the decision |

Two `RunStatus` unions already exist independently (`lib/data/workspace.ts` and `lib/runs/progress.ts`) plus two inline unions in components. This plan extends all four rather than unifying them — deduplicating them is a separate change with its own review.

---

### Task 1: `catalogsEqual` in packages/core

**Files:**
- Modify: `packages/core/src/locale-file/index.ts` (append after `mergeTranslations`)
- Test: `packages/core/src/locale-file/index.test.ts`

**Interfaces:**
- Consumes: `LocaleCatalog` (already exported from this module).
- Produces: `catalogsEqual(a: LocaleCatalog, b: LocaleCatalog): boolean` — used by Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/locale-file/index.test.ts`. Add `catalogsEqual` to the existing import list at the top of the file.

```ts
describe('catalogsEqual', () => {
  it('is true for the same keys and values', () => {
    expect(catalogsEqual({ a: 'A', b: 'B' }, { b: 'B', a: 'A' })).toBe(true);
  });

  it('is true for two empty catalogs', () => {
    expect(catalogsEqual({}, {})).toBe(true);
  });

  it('is false when a value differs', () => {
    expect(catalogsEqual({ a: 'A' }, { a: 'Ah' })).toBe(false);
  });

  it('is false when a key was added', () => {
    expect(catalogsEqual({ a: 'A' }, { a: 'A', b: 'B' })).toBe(false);
  });

  it('is false when a key was removed', () => {
    expect(catalogsEqual({ a: 'A', b: 'B' }, { a: 'A' })).toBe(false);
  });

  // The reason this compares parsed catalogs and not serialised bytes: a
  // repository whose locale files are indented differently would otherwise
  // produce a formatting-only pull request on every single run.
  it('ignores key order, which is what serialisation would not', () => {
    expect(
      JSON.stringify({ a: 'A', b: 'B' }) === JSON.stringify({ b: 'B', a: 'A' }),
    ).toBe(false);
    expect(catalogsEqual({ a: 'A', b: 'B' }, { b: 'B', a: 'A' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run packages/core/src/locale-file/index.test.ts -t catalogsEqual
```

Expected: FAIL — `catalogsEqual is not a function` (or a TypeScript error that it is not exported).

- [ ] **Step 3: Write the implementation**

Append to `packages/core/src/locale-file/index.ts`:

```ts
/**
 * Whether two catalogs carry the same translations.
 *
 * Compared as parsed key/value maps, deliberately, and not as the JSON this
 * pipeline would write. `JSON.stringify(..., 2)` normalises indentation, so a
 * repository formatted differently from our output would differ on every byte
 * comparison while carrying identical translations — and the pipeline would
 * open a reformatting pull request on every run. That is the same noise as the
 * empty pull request this function exists to prevent, wearing a better excuse.
 */
export function catalogsEqual(a: LocaleCatalog, b: LocaleCatalog): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key in b && a[key] === b[key]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run packages/core/src/locale-file/index.test.ts -t catalogsEqual
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/locale-file/index.ts packages/core/src/locale-file/index.test.ts
git commit -m "feat(core): catalogsEqual, to tell a real diff from a reformat"
```

---

### Task 2: The migration

**Files:**
- Create: `supabase/migrations/20260830000100_run_status_no_changes.sql`
- Create: `supabase/migrations/20260830000200_finish_run_no_changes_is_final.sql`

**Interfaces:**
- Produces: the `no_changes` value on `public.run_status`, accepted by `finish_run` with its existing signature (it already takes `p_status public.run_status`, so no signature change and no re-grant).

- [ ] **Step 1: Write the enum migration**

`supabase/migrations/20260830000100_run_status_no_changes.sql`:

```sql
-- A run that had nothing to do, said explicitly.
--
-- The pipeline called /v1/open-pr unconditionally once the quality and
-- ambiguity gates passed. When every key was already translated, the files it
-- committed were byte-identical to the branch, so GitHub produced an empty
-- commit and a pull request with zero changed files. Two such pull requests
-- are still open on the fixture repository from August.
--
-- A distinct status rather than `succeeded` with a null `pr_url`: those are two
-- different outcomes, and telling them apart by testing a nullable column for
-- null is exactly the kind of deduction this schema keeps removing. A reader —
-- the runs list, the activation funnel, a person — should not have to infer it.
--
-- Alone in its own migration. `alter type ... add value` and any statement that
-- *uses* the new value cannot share a transaction, and Supabase runs each
-- migration in one. Splitting removes the question entirely.
alter type public.run_status add value 'no_changes';
```

- [ ] **Step 2: Write the finality migration**

`supabase/migrations/20260830000200_finish_run_no_changes_is_final.sql`:

```sql
-- `no_changes` is terminal, and the guard has to know it.
--
-- finish_run refuses to rewrite a run that already reached 'succeeded',
-- 'partial' or 'failed', so a retry or a double submit cannot turn a recorded
-- failure into a success. 'awaiting_review' is deliberately absent from that
-- list: the ambiguity approval path finishes such a run later, on purpose.
--
-- 'no_changes' is not that kind of state. Nothing resumes it, so leaving it out
-- of the guard would let a second call overwrite it — the same history rewrite
-- the guard exists to stop.
--
-- Only the guard changes. The signature is identical, so the existing grants
-- still apply and are not repeated here.
create or replace function public.finish_run(
  p_run_id uuid,
  p_status public.run_status,
  p_stage public.run_stage,
  p_framework text default null,
  p_keys_extracted int default 0,
  p_keys_translated int default 0,
  p_locales_succeeded int default 0,
  p_locales_failed int default 0,
  p_error text default null,
  p_pr_url text default null,
  p_pr_number int default null,
  p_branch text default null
)
returns public.runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.runs;
  updated public.runs;
begin
  select * into existing from public.runs where id = p_run_id;
  if existing.id is null then
    raise exception 'run not found' using errcode = '42704';
  end if;
  if not public.is_org_member(existing.organization_id) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if existing.status in ('succeeded','partial','failed','no_changes') then
    raise exception 'run % is already finished', p_run_id using errcode = '55000';
  end if;

  update public.runs set
    status = p_status,
    stage = p_stage,
    framework = coalesce(p_framework, framework),
    keys_extracted = p_keys_extracted,
    keys_translated = p_keys_translated,
    locales_succeeded = p_locales_succeeded,
    locales_failed = p_locales_failed,
    error = p_error,
    pr_url = p_pr_url,
    pr_number = p_pr_number,
    branch = p_branch,
    finished_at = now()
  where id = p_run_id
  returning * into updated;

  return updated;
end;
$$;
```

- [ ] **Step 3: Apply both migrations to the development project and verify**

Apply `20260830000100` then `20260830000200` to `aguwalokxfgtqbzmdjbs`, in that order, then check:

```sql
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'run_status' order by e.enumsortorder;
```

Expected: `queued, running, succeeded, partial, failed, awaiting_review, no_changes`.

- [ ] **Step 4: Apply both migrations to the production project and verify**

Same two files, same order, against `ijgheekdihgssktyweyy`, then the same query with the same expected output. **Do not skip this step** — a status the code writes and the database rejects fails at the end of a run, after the model has been paid.

- [ ] **Step 5: Run the Supabase advisors**

Run `get_advisors` for both projects (security, then performance). Expected: no new finding attributable to these two migrations.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260830000100_run_status_no_changes.sql supabase/migrations/20260830000200_finish_run_no_changes_is_final.sql
git commit -m "feat(db): a run can end in no_changes, and that state is final"
```

---

### Task 3: Teach the interface the new status

Done before the pipeline can produce it, on purpose: the status maps are exhaustive `Record`s keyed by the union, so a value reaching the UI before it is declared renders `undefined` and throws. Widening first means there is never a window where that can happen.

**Files:**
- Modify: `apps/web/src/lib/runs/progress.ts`
- Modify: `apps/web/src/lib/data/workspace.ts`
- Modify: `apps/web/src/components/runs-table.tsx`
- Modify: `apps/web/src/app/[org]/projects/[project]/runs-section.tsx`
- Test: `apps/web/src/lib/runs/progress.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `'no_changes'` as a member of `RunStatus` in both `lib/runs/progress.ts` and `lib/data/workspace.ts`; `RunProgress` gains it under `kind: 'finished'`. Task 4 relies on the status being renderable.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/lib/runs/progress.test.ts`:

```ts
describe('no_changes', () => {
  it('is a finished state, not an active one', () => {
    expect(
      runProgress({
        status: 'no_changes',
        stage: 'translate',
        progressAt: null,
      }),
    ).toEqual({ kind: 'finished', status: 'no_changes' });
  });

  it('is not polled, because nothing will change', () => {
    expect(
      shouldPoll(
        runProgress({
          status: 'no_changes',
          stage: 'translate',
          progressAt: null,
        }),
      ),
    ).toBe(false);
  });

  // A run that stopped for lack of work is not stalled, however long ago it
  // stopped. Without the finished branch it would fall through to the
  // heartbeat check and be reported as dead.
  it('is not reported as stalled when it is old', () => {
    expect(
      runProgress({
        status: 'no_changes',
        stage: 'translate',
        progressAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ).toEqual({ kind: 'finished', status: 'no_changes' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run apps/web/src/lib/runs/progress.test.ts -t no_changes
```

Expected: FAIL — a TypeScript error that `"no_changes"` is not assignable to `RunStatus`.

- [ ] **Step 3: Widen the two `RunStatus` unions and `RunProgress`**

In `apps/web/src/lib/runs/progress.ts`, replace the `RunStatus` and `RunProgress` declarations:

```ts
export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'succeeded'
  | 'partial'
  | 'failed'
  /** Finished with nothing to do: every key was already translated. */
  | 'no_changes';

export type RunProgress =
  | { kind: 'queued' }
  | { kind: 'active'; stage: RunStage | string }
  | { kind: 'stalled'; stage: RunStage | string; silentForMs: number }
  | { kind: 'awaiting-review' }
  | {
      kind: 'finished';
      status: 'succeeded' | 'partial' | 'failed' | 'no_changes';
    };
```

In the same file, extend the first branch of `runProgress`:

```ts
  if (
    status === 'succeeded' ||
    status === 'partial' ||
    status === 'failed' ||
    status === 'no_changes'
  ) {
    return { kind: 'finished', status };
  }
```

In `apps/web/src/lib/data/workspace.ts`, replace the `RunStatus` declaration:

```ts
export type RunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  /** Stopped on purpose: the agent found something it will not guess at. */
  | 'awaiting_review'
  /** Finished with nothing to do: every key was already translated. */
  | 'no_changes';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run apps/web/src/lib/runs/progress.test.ts -t no_changes
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Extend the two status maps**

In `apps/web/src/components/runs-table.tsx`, add `| 'no_changes'` to the `status` union inside `RunTableRow`, then add to `STATE`:

```ts
  // Neutral, not confident. Confident is the colour of a pull request being
  // waiting for you; this run produced nothing to look at. Painting it the
  // same green would make "your translations are ready" and "there was
  // nothing to do" the same signal at a glance.
  no_changes: { tone: 'neutral', label: 'No changes needed' },
```

Add a filter option alongside the existing ones in `FILTERS`:

```ts
  { value: 'no_changes', label: 'No changes' },
```

In `apps/web/src/app/[org]/projects/[project]/runs-section.tsx`, add `| 'no_changes'` to the `status` union inside `RunRow`, then add to `STATUS`:

```ts
  // Neutral, not confident — see runs-table.tsx for why the two successes are
  // not the same colour.
  no_changes: { tone: 'neutral', label: 'No changes needed' },
```

- [ ] **Step 6: Typecheck and run the full unit suite**

```bash
npm run lint && npm run typecheck && npm run test
```

Expected: all pass. If `turbo` reports a cached success on `packages/ui`, re-run with `--force` — `type-scale.test.ts` reads the app directories.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/runs/progress.ts apps/web/src/lib/runs/progress.test.ts apps/web/src/lib/data/workspace.ts apps/web/src/components/runs-table.tsx "apps/web/src/app/[org]/projects/[project]/runs-section.tsx"
git commit -m "feat(web): the interface can render a run that had nothing to do"
```

---

### Task 4: The decision in the pipeline

**Files:**
- Modify: `apps/web/src/app/[org]/projects/[project]/run-actions.ts`

**Interfaces:**
- Consumes: `catalogsEqual` from Task 1, the `no_changes` enum value from Task 2, the widened unions from Task 3.
- Produces: a run finishing at `status: 'no_changes'`, `stage: 'translate'`, `pr_url: null`.

Stage stays `translate` because that is literally where the run stops. Adding a stage would change the five fixed pipeline names (DESIGN.md §1.4), which is a larger commitment than this change earns.

- [ ] **Step 1: Add `catalogsEqual` to the core import**

In the `@localize-infra/core` import block at the top of `run-actions.ts`, add `catalogsEqual` in alphabetical position (before `detectFramework`):

```ts
import {
  buildKeyCatalog,
  buildOpenPrRequest,
  catalogsEqual,
  detectFramework,
  extractFromProject,
  mergeLocaleFile,
  mergeTranslations,
  pendingKeys,
  readLocaleFile,
  repoRelativePath,
} from '@localize-infra/core';
```

- [ ] **Step 2: Track whether the source file changed**

Find this line:

```ts
    const mergedSource = mergeLocaleFile(localesDir, sourceLocale, fresh);
```

Replace it with:

```ts
    /*
     * Read before merging, because the merge is what we are comparing against.
     * `mergeLocaleFile` reads this file internally but does not hand it back,
     * so the "before" has to be taken separately.
     */
    const existingSource = readLocaleFile(localesDir, sourceLocale);
    const mergedSource = mergeLocaleFile(localesDir, sourceLocale, fresh);

    /*
     * Whether this run has anything to commit.
     *
     * `existing` is read from a checkout of the base branch, so comparing the
     * merge against it is comparing against exactly what a pull request would
     * be opened on top of. Nothing here costs a network call: both sides are
     * already in memory.
     */
    let anyChanged = !catalogsEqual(mergedSource, existingSource);
```

- [ ] **Step 3: Track whether each locale changed**

Find this line inside the locale loop:

```ts
        const merged = mergeTranslations(fresh, existing, translated);
```

Insert immediately after it:

```ts
        if (!catalogsEqual(merged, existing)) anyChanged = true;
```

- [ ] **Step 4: Add the terminal branch**

Find the guard that follows the locale loop:

```ts
    if (localesSucceeded === 0) {
      // Now true when it fires: the empty-list case is refused above, so
      // reaching here means locales were attempted and all of them failed.
      throw new Error(
        `All ${localesFailed} target locale(s) failed. Last error: ${failure ?? 'unknown'}`,
      );
    }
```

Insert immediately **after** that block:

```ts
    /*
     * Nothing to commit, so nothing is committed.
     *
     * This used to fall straight through to /v1/open-pr, which created a
     * branch, blobs whose SHAs already existed, a tree identical to the base
     * tree and therefore an empty commit — a pull request with zero changed
     * files. Two of them are still open on the fixture repository.
     *
     * Placed after the all-failed guard and gated on `localesFailed === 0`: a
     * run where a locale threw has not established that there was nothing to
     * do, only that it did not get far enough to find out. Escalations cannot
     * exist here — they come from model responses, and a run with nothing
     * pending made no model call — but it is checked rather than assumed,
     * because that reasoning is about today's control flow and this branch
     * must not silently swallow a question.
     *
     * Before `record_run_translations`, so a repeated click does not add
     * another dozen `preserved` proposals nobody asked for. The trade is that
     * the review screen shows nothing for such a run, which is correct: there
     * is nothing to review.
     *
     * The quality gate is skipped for the same reason — it exists to stop this
     * run from committing something wrong, and this run commits nothing.
     * Re-checking content already on the branch would report a failure the run
     * did not cause.
     */
    if (!anyChanged && localesFailed === 0 && escalations.length === 0) {
      await supabase.rpc('finish_run', {
        p_run_id: run.id,
        p_status: 'no_changes',
        p_stage: 'translate',
        p_framework: framework,
        p_keys_extracted: keysExtracted,
        p_keys_translated: keysTranslated,
        p_locales_succeeded: localesSucceeded,
        p_locales_failed: localesFailed,
        p_error: null,
        p_pr_url: null,
        p_pr_number: null,
        p_branch: null,
      });
      revalidatePath(`/${organization.slug}/projects/${project.slug}`);
      return { runId: run.id };
    }
```

- [ ] **Step 5: Typecheck and run the unit suite**

```bash
npm run lint && npm run typecheck && npm run test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/[org]/projects/[project]/run-actions.ts"
git commit -m "fix(web): a run with nothing to translate opens no pull request"
```

---

### Task 5: Gates, the follow-up note, and the pull request

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Kill any surviving dev servers**

```bash
npx kill-port 3210 3211
```

A `next start` left running answers with stale code, and `reuseExistingServer` is on outside CI.

- [ ] **Step 2: Run the full gates**

```bash
npm run gates
```

Expected: lint, typecheck, test, test:e2e all green. Run the two e2e suites separately if the combined run flakes on a perf test — that flake predates this change and reproduces on `master`.

- [ ] **Step 3: Record the residual gap in CLAUDE.md**

In the `apps/web` section, add:

```markdown
Un run qui ne trouve rien à traduire finit désormais en `no_changes` et
n'ouvre aucune PR. **`packages/cli` et `apps/api` gardent le défaut** : ils
appellent `/v1/open-pr` sans comparer, donc un CLI lancé deux fois de suite
produit toujours une PR vide. Le correctif durable serait côté API — comparer
le SHA d'arbre obtenu à celui de la base après `createTree` — mais il exige de
réordonner `open-pr.ts`, dont le `createRef` précède le `createTree`, et de
changer le contrat de `/v1/open-pr`, donc `packages/schemas` et les deux
appelants. Non fait, et su.
```

- [ ] **Step 4: Commit and open the pull request**

```bash
git add CLAUDE.md
git commit -m "docs: the CLI still opens empty pull requests, and why that was left"
git push -u origin <branch>
gh pr create --fill
gh pr checks --watch
```

Expected: `test` and `e2e` both pass. Both are required by branch protection.

- [ ] **Step 5: Verify against the real fixture, before merging**

With the preview deployment, open the project on `localize-infra-fixture-vite` and press **Run pipeline**. Expected: the run finishes in a few seconds, badge **No changes needed**, `keys_translated = 0`, no pull request created. Confirm with:

```sql
select status, stage, keys_translated, locales_succeeded, pr_url
from runs order by created_at desc limit 1;
```

Expected: `no_changes | translate | 0 | 4 | null`.

Then confirm no new pull request exists:

```bash
gh pr list --repo maxencerousseau38-prog/localize-infra-fixture-vite --state open
```

Expected: still only #1 and #2, the two empty ones from August.

---

## Self-Review

**Spec coverage.** Detection where both sides are already in memory — Task 4 Steps 2–3. Semantic rather than byte comparison — Task 1. Distinct terminal status with its migration — Task 2. Finality guard, found while reading `finish_run` and not in the original proposal — Task 2 Step 2. Interface plumbing across all four unions — Task 3. Proposals not accumulated on repeat clicks — Task 4 Step 4. CLI and API left alone but recorded — Task 5 Step 3. Empirical check on the real fixture — Task 5 Step 5.

**Known residual, stated rather than hidden.** A run where one locale throws and the others changed nothing still reaches `/v1/open-pr` and can still open an empty pull request. The `localesFailed === 0` gate is what makes that case fall through deliberately instead of being mislabelled `no_changes`. It is rare, it is not fixed here, and Task 5's note does not claim otherwise.

**Type consistency.** `catalogsEqual(a, b): boolean` is defined in Task 1 and used with that exact name and arity in Task 4. `'no_changes'` is spelled identically in the enum (Task 2), both `RunStatus` unions and both status maps (Task 3), and the `finish_run` call (Task 4).
