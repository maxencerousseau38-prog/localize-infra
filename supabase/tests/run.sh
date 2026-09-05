#!/usr/bin/env bash
#
# Run the database proofs in this directory and decide whether they passed.
#
# These are not pgTAP, despite living in `supabase/tests/`. Each is a single
# `do $$ … $$` block that builds a verdict string and ends with a deliberate
# `raise exception`, so the transaction rolls back and the database is left
# exactly as it was found. `supabase test db` would be the wrong tool: it
# expects pgTAP, and every one of these scripts exits non-zero on success.
#
# **The exit code therefore proves nothing, and neither does the marker.** A
# script that aborted early — a missing table, a renamed function — also exits
# non-zero, and one that reached its raise still reports every individual check
# inside the message. So this reads the verdict:
#
#     ISOLATION >> A-sees-own-org=t(want t); B-write-into-A-blocked=t(want t); …
#
# and fails when any pair disagrees with what it wanted. A run that produces no
# verdict line at all is a failure too — that is the aborted-early case, and
# treating it as a pass is exactly how a proof becomes decoration.
#
# Usage: supabase/tests/run.sh <database-url>
set -uo pipefail

db="${1:?usage: supabase/tests/run.sh <database-url>}"
status=0

shopt -s nullglob
for file in supabase/tests/*.sql; do
  echo "── ${file}"
  output="$(psql "$db" -X -q -f "$file" 2>&1 || true)"

  verdict="$(printf '%s\n' "$output" | grep -oE '(ISOLATION|CLOSER-SUPPRESSION) >>.*' || true)"
  if [ -z "$verdict" ]; then
    echo "   FAIL — no verdict line: the script did not reach its raise."
    printf '%s\n' "$output" | tail -20 | sed 's/^/   /'
    status=1
    continue
  fi

  mismatches="$(printf '%s\n' "$verdict" | awk '
    {
      while (match($0, /[A-Za-z0-9_-]+=[tf]\(want [tf]\)/)) {
        token = substr($0, RSTART, RLENGTH)
        $0 = substr($0, RSTART + RLENGTH)
        split(token, parts, "=")
        actual = substr(parts[2], 1, 1)
        wanted = substr(token, length(token) - 1, 1)
        if (actual != wanted) print token
      }
    }')"

  checks="$(printf '%s\n' "$verdict" | grep -oE '[A-Za-z0-9_-]+=[tf]\(want [tf]\)' | wc -l)"
  if [ "$checks" -eq 0 ]; then
    echo "   FAIL — verdict line carries no checks: ${verdict}"
    status=1
    continue
  fi

  if [ -n "$mismatches" ]; then
    echo "   FAIL — ${checks} check(s), of which these disagree:"
    printf '%s\n' "$mismatches" | sed 's/^/     /'
    status=1
    continue
  fi

  echo "   ok — ${checks} check(s)"
done

exit "$status"
