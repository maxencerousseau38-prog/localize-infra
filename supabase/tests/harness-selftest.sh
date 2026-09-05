#!/usr/bin/env bash
#
# Does run.sh actually check what it says it checks?
#
# It did not. For its whole life it read `=[tf](want [tf])` and dropped every
# pair whose value was not `t` or `f` — 21 of the 60 assertions then in this
# directory, including `creator-role=owner` and every cross-tenant read in
# tenant-isolation.sql: `B-sees-A-org`, `B-sees-A-proj`, `B-sees-A-members`.
# Those are the assertions that file exists for. `B-sees-A-proj=1(want 0)` was
# reported as `ok — 7 check(s)`.
#
# A guard that measures less than it claims does not announce itself: its
# symptom is a success. So the guard gets a guard, and this is it. It feeds
# crafted verdicts through the real run.sh — same grep, same awk, same exit
# code — with a psql stand-in, so it needs no database and runs anywhere.
#
# Add a case here whenever a proof introduces a value shape this has not seen.
# The expensive shapes are the ones with punctuation: a slash, embedded dots,
# and a trailing dot each broke a plausible version of the parser.
set -uo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
shim="$(mktemp -d)"
trap 'rm -rf "$shim"' EXIT

cat > "$shim/psql" <<'STUB'
#!/usr/bin/env bash
echo "psql: ERROR:  P0001: $VERDICT"
echo "CONTEXT:  PL/pgSQL function inline_code_block line 57 at RAISE"
exit 1
STUB
chmod +x "$shim/psql"

failures=0

# want_status: 0 for a verdict that must pass, 1 for one that must be caught.
# want_checks: how many checks run.sh must report having compared. A case that
# fails for the right reason but counts the wrong number is still a defect —
# under-counting is the whole bug this file exists for.
check() {
  local name="$1" want_status="$2" want_checks="$3" verdict="$4"
  local out status checks

  out="$(cd "$root" && VERDICT="$verdict" PATH="$shim:$PATH" \
        bash supabase/tests/run.sh 'stub://db' 2>&1)"
  status=$?
  checks="$(printf '%s\n' "$out" | grep -oE '[0-9]+ check\(s\)' | head -1 | grep -oE '^[0-9]+')"

  if [ "$status" -ne "$want_status" ] || [ "${checks:-0}" -ne "$want_checks" ]; then
    echo "  FAIL ${name}: status=${status}(want ${want_status}) checks=${checks:-none}(want ${want_checks})"
    printf '%s\n' "$out" | head -4 | sed 's/^/       /'
    failures=$((failures + 1))
  else
    echo "  ok   ${name}"
  fi
}

echo "── run.sh self-test"

# Booleans alone: what the old parser handled, kept so a fix cannot regress it.
check 'booleans agree'  0 2 'ISOLATION >> a=t(want t); b=f(want f); '
check 'boolean differs' 1 2 'ISOLATION >> a=f(want t); b=f(want f); '

# Numbers, which the old parser ignored entirely.
check 'numbers agree'   0 2 'ISOLATION >> B-sees-A-proj=0(want 0); A-orgs=1(want 1); '
check 'number differs'  1 2 'ISOLATION >> B-sees-A-proj=1(want 0); A-orgs=1(want 1); '

# Multi-character values compared whole. The old parser read one character per
# side, so `10` and `1` agreed, and so did `member` and `mine`.
check 'word differs'         1 1 'ISOLATION >> creator-role=member(want owner); '
check 'same first character' 1 1 'ISOLATION >> count=10(want 1); '

# Punctuation in values, from closer-suppression.sql. The trailing dot is a
# one-character difference at the end of a long value.
check 'slash agrees'        0 1 'CLOSER-SUPPRESSION >> f2=question/not_a_fit(want question/not_a_fit); '
check 'dotted agrees'       0 1 'CLOSER-SUPPRESSION >> f4=legacy.test.invalid.(want legacy.test.invalid.); '
check 'trailing dot missing' 1 1 'CLOSER-SUPPRESSION >> f4=legacy.test.invalid(want legacy.test.invalid.); '

# The two ways a proof can produce nothing worth trusting. Both must fail: a
# script that aborted early, and one whose verdict carries no checks at all.
check 'no verdict line'  1 0 'nothing resembling a verdict'
check 'verdict no pairs' 1 0 'ROLE-PERMISSIONS >> ran, but said nothing checkable'

if [ "$failures" -ne 0 ]; then
  echo "── ${failures} self-test case(s) failed: run.sh is not checking what it reports."
  exit 1
fi

echo "── run.sh self-test passed"
