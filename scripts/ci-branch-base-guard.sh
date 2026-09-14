#!/usr/bin/env bash
# ci-branch-base-guard.sh — reject a dev-bound PR whose branch was cut from
# staging/main instead of dev (landr-d112r).
#
# WHY THIS EXISTS
# ================
# landr-dashboard PR #640 (fix/landr-g1cn7) was branched off main/staging
# instead of dev, dragging the staging->main and dev->staging release-
# promotion merge commits into dev. dev and staging ended up with TWO merge
# bases (criss-cross). Local `git merge` (ort strategy) merges that cleanly,
# but GitHub's `POST /repos/{org}/{repo}/merges` API
# (landr-api app/services/github_promotion.py) picked a different merge base
# and returned 409 (merge_status=conflict), breaking the dev->staging
# promotion. See landr-d112r for the full incident writeup.
#
# WHAT IT CHECKS
# ===============
# Any commit reachable from HEAD but not from origin/dev ("git rev-list HEAD
# ^origin/dev") that is ALSO an ancestor of origin/staging or origin/main is
# a release-promotion commit that has no business being on a dev-bound
# branch — it means the branch was cut from staging/main, not from dev.
#
# origin/staging or origin/main may not exist in every repo (e.g.
# landr-mobile currently has no staging branch) — in that case the check for
# that ref is skipped, not failed.
#
# USAGE
# ======
#   ci-branch-base-guard.sh
#
# Expects the calling job to have already fetched origin/dev,
# origin/staging, and origin/main with enough history (fetch-depth: 0) and
# to be running inside the checked-out branch under test.

set -euo pipefail

fail=0

if ! git rev-parse --verify --quiet origin/dev >/dev/null; then
  echo "::error::origin/dev not found — checkout must fetch-depth: 0 and include origin/dev" >&2
  exit 1
fi

if [ -z "$(git rev-list -1 HEAD ^origin/dev)" ]; then
  echo "No commits ahead of origin/dev — nothing to check."
  exit 0
fi

for ref in origin/staging origin/main; do
  if ! git rev-parse --verify --quiet "$ref" >/dev/null; then
    echo "Skipping $ref (branch does not exist in this repo)."
    continue
  fi

  # Offending commits = ancestors of merge-base(HEAD, ref) that are not
  # ancestors of origin/dev. Any commit reachable from both HEAD and ref is,
  # by definition, an ancestor of one of their merge-bases, so this is
  # exactly "commits on this branch that are already on ref" — computed in
  # one rev-list call instead of an --is-ancestor probe per commit (this
  # branch can carry thousands of commits when cut from main).
  mapfile -t merge_bases < <(git merge-base --all HEAD "$ref" 2>/dev/null || true)
  if [ "${#merge_bases[@]}" -eq 0 ]; then
    echo "No common ancestor with $ref — skipping."
    continue
  fi

  mapfile -t offending < <(git rev-list "${merge_bases[@]}" ^origin/dev)

  if [ "${#offending[@]}" -gt 0 ]; then
    fail=1
    echo "::error::Found ${#offending[@]} commit(s) on this branch that are already on $ref — this branch was likely cut from $ref instead of origin/dev."
    for c in "${offending[@]:0:20}"; do
      echo "  - $(git log -1 --format='%h %s' "$c")"
    done
    if [ "${#offending[@]}" -gt 20 ]; then
      echo "  ... and $((${#offending[@]} - 20)) more"
    fi
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "::error::This branch contains release-promotion commits from staging/main that are not yet in dev."
  echo "::error::Fix: rebase this branch onto origin/dev (git rebase origin/dev), or re-cut it from origin/dev, then force-push."
  echo "::error::Merging this as-is risks a criss-cross merge base between dev and staging, which can break the dev->staging promotion (GitHub merge API 409, see landr-d112r)."
  exit 1
fi

echo "OK: no staging/main-only commits found on this branch."
