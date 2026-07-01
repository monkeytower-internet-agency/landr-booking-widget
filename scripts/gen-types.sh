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
# podman user socket rather than a real Docker daemon.
#
# Set LANDR_API_REPO to override which landr-api checkout to generate from
# (useful when running from a worktree, where the default sibling-dir lookup
# doesn't apply).
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

echo "$HEADER" > "$OUT_FILE"
(
  cd "$API_REPO"
  DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock" \
    supabase gen types typescript \
    --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
) >> "$OUT_FILE"

echo "Wrote $OUT_FILE"
