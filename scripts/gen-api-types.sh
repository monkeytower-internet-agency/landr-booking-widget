#!/usr/bin/env bash
# landr-y3oj.2 — regenerate src/types/api.gen.ts from contracts/openapi.json.
#
# contracts/openapi.json is a synced copy of landr-api's committed
# openapi.json (the FastAPI schema source of truth — see
# landr-api/scripts/dump_openapi.sh). It's committed here too so this repo's
# CI can verify api.gen.ts is current without needing a live landr-api
# checkout (landr-api is private; cross-repo checkout in this repo's CI would
# need a PAT that doesn't exist yet — see docs note in landr-api).
#
# Running this script alone regenerates api.gen.ts from whatever
# contracts/openapi.json is currently committed (fast, no network/DB) — this
# is exactly what CI's drift check re-runs.
#
# To also REFRESH contracts/openapi.json from a live landr-api checkout
# first, set LANDR_API_REPO (or rely on the sibling-dir default) and pass
# --sync, or just run landr-api/scripts/regen-contracts.sh from a checkout
# with all repos as siblings, which does this for every repo in one shot.
#
# Set LANDR_API_REPO to a landr-api checkout to sync contracts/openapi.json
# from it before regenerating api.gen.ts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="$REPO_ROOT/contracts/openapi.json"
OUT_FILE="$REPO_ROOT/src/types/api.gen.ts"

API_REPO=""
if [ -n "${LANDR_API_REPO:-}" ]; then
  API_REPO="$(cd "$LANDR_API_REPO" && pwd)"
elif [ -d "$REPO_ROOT/../landr-api" ] && [ -f "$REPO_ROOT/../landr-api/openapi.json" ]; then
  API_REPO="$(cd "$REPO_ROOT/../landr-api" && pwd)"
fi

if [ -n "$API_REPO" ]; then
  mkdir -p "$REPO_ROOT/contracts"
  cp "$API_REPO/openapi.json" "$SCHEMA_FILE"
  echo "Synced $SCHEMA_FILE from $API_REPO/openapi.json"
fi

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "error: $SCHEMA_FILE not found and no landr-api sibling checkout available to sync from." >&2
  exit 1
fi

HEADER='/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * FastAPI request/response shapes generated from contracts/openapi.json (a
 * synced copy of landr-api'"'"'s committed openapi.json — see
 * landr-api/scripts/dump_openapi.sh for the source dump and
 * landr-api/scripts/regen-contracts.sh for the cross-repo sync).
 *
 * Regenerate: npm run gen:api-types (see scripts/gen-api-types.sh)
 *
 * landr-y3oj.2 introduced this. Full call-site adoption rides landr-y3oj.3.
 */
'

echo "$HEADER" > "$OUT_FILE"
npx openapi-typescript "$SCHEMA_FILE" >> "$OUT_FILE"

echo "Wrote $OUT_FILE"
