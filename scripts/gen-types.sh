#!/usr/bin/env bash
# landr-52ik.5 — regenerate src/types/database.gen.ts from the local Supabase
# stack (landr-api/supabase is the schema source of truth; see CLAUDE.md
# "Migrations are the source of truth for schema"). Mirrors landr-mobile's
# database.gen.ts pattern.
#
# NOTE: this widget talks to FastAPI (never Supabase directly at runtime) —
# database.gen.ts is a compile-time-only anchor so hand-written wire types in
# src/api/types.ts (e.g. ProductKind) that mirror a native Postgres enum can
# derive from it instead of duplicating the literal union, catching DB/API
# drift via tsc. It adds zero runtime dependencies (type-only import, erased
# at build).
#
# Requires the local Supabase stack to be up (Trillian, local podman):
#   cd ~/Projects/landr/landr-api && supabase start
#
# The Supabase CLI shells out to `docker inspect` even for --db-url generation;
# on Trillian the stack runs under podman, so we point DOCKER_HOST at the
# podman user socket rather than a real Docker daemon — but only when that
# socket actually exists (landr-y3oj.2): GitHub Actions runners have a real
# Docker daemon at the default location, and forcing DOCKER_HOST at a
# nonexistent podman socket there would break the CLI.
#
# Set LANDR_API_REPO to override which landr-api checkout to generate from
# (useful when running from a worktree, where the default sibling-dir lookup
# doesn't apply).
#
# Set SUPABASE_DB_URL to override the target Postgres DSN (default:
# 127.0.0.1:54322, Trillian's interactive dev port). landr-api's
# scripts/check-downstream-db-types.sh (landr-qwlp.3) sets this to its CI
# slot's isolated port so the downstream drift check validates a PR's OWN
# migrations instead of whatever is in interactive dev at the time.
#
# landr-rt4uu — `supabase gen types typescript` has been observed to hang
# INDEFINITELY on Trillian, partway through streaming output (reproduced 3x
# back-to-back: truncated at 6956/9681/9947 of ~12964 lines, each only ending
# because an external `timeout 300` killed it — left alone it never returns).
# It is not a Postgres-side block (pg_stat_activity showed no matching
# backend, waiting or otherwise, at the time of the hang) — the stuck process
# was sleeping client-side in the CLI's own Go runtime. Root cause traced to
# a CLI regression: v2.95.4 (Trillian's stale ~/.local/bin/supabase, ahead of
# the RPM-managed build on $PATH) hung 3/3 back-to-back runs; the
# RPM-managed v2.98.2 ALSO hung under the same test; v2.116.0 completed
# cleanly 3/3 (3-21s each, full output every time) — see landr-rt4uu.
# Because a plain `... >> "$OUT_FILE"` redirect writes straight into the
# COMMITTED file with no validation, a hung/truncated run used to land a
# syntactically-broken database.gen.ts with a silent `exit 0` (the shell only
# ever saw the redirect, never the CLI's own truncated stream).
#
# This script does not rely on the PATH-shadowing bug staying fixed: it
# invokes a PINNED CLI version via `npx`, sidestepping whatever `supabase`
# a given PATH resolves to entirely. Override SUPABASE_CLI_VERSION to move
# the pin if a future version regresses again.
#
# Guard, defense-in-depth (do not assume the pinned version stays reliable
# forever, or that npx/network is always available):
#   1. Generate into a scratch temp file, never directly into $OUT_FILE.
#   2. Retry up to 3x under `timeout` — a hang never self-recovers, so a
#      retry only helps if the PREVIOUS attempt's stuck process is reaped
#      first, which the `timeout` call guarantees (see landr-rt4uu: killed
#      supabase processes do not linger past their `timeout` wrapper here).
#   3. Validate the result before trusting it: non-empty, ends with the
#      CLI's normal `} as const` trailer (a truncated stream never reaches
#      it), and parses as TypeScript (tsc, run outside any tsconfig.json's
#      directory so it type-checks the file standalone).
#   4. Only on full success, atomically move the temp file into place.
#      Any failure exits non-zero with a clear message and leaves the
#      committed $OUT_FILE untouched — never a partial/broken overwrite.
#
# Override SUPABASE_GEN_TYPES_TIMEOUT (seconds, default 120) or
# SUPABASE_GEN_TYPES_ATTEMPTS (default 3) to tune retry behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="$REPO_ROOT/src/types/database.gen.ts"

if [ -n "${LANDR_API_REPO:-}" ]; then
  API_REPO="$(cd "$LANDR_API_REPO" && pwd)"
elif [ -d "$REPO_ROOT/../landr-api/supabase" ]; then
  API_REPO="$(cd "$REPO_ROOT/../landr-api" && pwd)"
else
  API_REPO="$(cd "$HOME/Projects/landr/landr-api" && pwd)"
fi

HEADER='// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Full Supabase schema (every table/view/enum/function shape) generated from
// landr-api/supabase (Postgres migrations are the source of truth — see
// CLAUDE.md "Migrations are the source of truth for schema"). This widget
// talks to FastAPI, never Supabase directly — this file is a compile-time
// anchor only: hand-written wire types in src/api/types.ts that mirror a
// native Postgres enum (e.g. `ProductKind`) derive from the `Enums<>` helper
// below instead of duplicating the literal union, so DB/API drift is caught
// by tsc instead of rotting silently. Mirrors the pattern already used in
// landr-mobile (src/types/database.gen.ts) and landr-dashboard.
//
// Regenerate: npm run gen:types (see scripts/gen-types.sh)
//
// landr-52ik.5 adopted this; full adoption across the app rides landr-y3oj.3.'

PODMAN_SOCK="/run/user/$(id -u)/podman/podman.sock"
if [ -S "$PODMAN_SOCK" ]; then
  export DOCKER_HOST="unix://${PODMAN_SOCK}"
fi

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
GEN_TIMEOUT="${SUPABASE_GEN_TYPES_TIMEOUT:-120}"
MAX_ATTEMPTS="${SUPABASE_GEN_TYPES_ATTEMPTS:-3}"
# landr-rt4uu: pinned via npx, not the ambient `supabase` on PATH — see the
# header comment above for why.
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.116.0}"
SUPABASE_CLI=(npx -y "supabase@${SUPABASE_CLI_VERSION}")

TMP_BODY="$(mktemp "${TMPDIR:-/tmp}/database.gen.body.XXXXXX.ts")"
TMP_FULL="$(mktemp "${TMPDIR:-/tmp}/database.gen.full.XXXXXX.ts")"
cleanup() { rm -f "$TMP_BODY" "$TMP_FULL"; }
trap cleanup EXIT

SUCCESS=0
ATTEMPT=1
while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  echo "gen-types: attempt ${ATTEMPT}/${MAX_ATTEMPTS} (timeout ${GEN_TIMEOUT}s)..." >&2
  : > "$TMP_BODY"
  if (
    cd "$API_REPO"
    timeout "$GEN_TIMEOUT" "${SUPABASE_CLI[@]}" gen types typescript --db-url "$DB_URL"
  ) >> "$TMP_BODY"; then
    SUCCESS=1
    break
  fi
  EC=$?
  echo "gen-types: attempt ${ATTEMPT} failed or timed out (exit ${EC}, likely a hung/killed \`supabase gen types\` — see landr-rt4uu)." >&2
  ATTEMPT=$((ATTEMPT + 1))
  GEN_TIMEOUT=$((GEN_TIMEOUT + 60))
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "gen-types: FAILED after ${MAX_ATTEMPTS} attempts — leaving ${OUT_FILE} untouched." >&2
  exit 1
fi

# ── Validate before trusting it ─────────────────────────────────────────
if [ ! -s "$TMP_BODY" ]; then
  echo "gen-types: generated output is empty — leaving ${OUT_FILE} untouched." >&2
  exit 1
fi

if ! tail -c 200 "$TMP_BODY" | grep -q '^} as const'; then
  echo "gen-types: generated output does not end with the expected '} as const' trailer (truncated mid-stream, see landr-rt4uu) — leaving ${OUT_FILE} untouched." >&2
  echo "gen-types: last 5 lines of the partial output:" >&2
  tail -n 5 "$TMP_BODY" >&2
  exit 1
fi

printf '%s\n' "$HEADER" > "$TMP_FULL"
cat "$TMP_BODY" >> "$TMP_FULL"

# Type-check the candidate file standalone: run from a directory with no
# ancestor tsconfig.json, so tsc parses this ONE file on its own terms
# instead of erroring "tsconfig.json is present but will not be loaded"
# (TS5112) or pulling in the whole app project.
TSC_BIN="$REPO_ROOT/node_modules/.bin/tsc"
if [ -x "$TSC_BIN" ]; then
  if ! ( cd "${TMPDIR:-/tmp}" && "$TSC_BIN" --noEmit --skipLibCheck "$TMP_FULL" ); then
    echo "gen-types: generated output failed to type-check — leaving ${OUT_FILE} untouched." >&2
    exit 1
  fi
else
  echo "gen-types: warning — $TSC_BIN not found, skipping the TypeScript parse check (npm install first for the full guard)." >&2
fi

mv "$TMP_FULL" "$OUT_FILE"
echo "Wrote $OUT_FILE"
