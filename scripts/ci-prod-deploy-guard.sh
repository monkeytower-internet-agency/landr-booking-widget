#!/usr/bin/env bash
#
# scripts/ci-prod-deploy-guard.sh -- pre-deploy git-shape guard for the
# production deploy job (landr-uzb1o.22).
#
# WHY
# ===
# The repo is on GitHub Free: no branch protection, no rulesets. ANY push to
# `main` would therefore run the production deploy and publish untested code.
# This script is the compensating control. It runs BEFORE any step that holds a
# deploy credential and exits non-zero (with an ::error:: annotation) when the
# new main tip is not something the release console produced.
#
# This is the same script in every frontend repo (vendored verbatim, because a
# public repo cannot call a private reusable workflow). It is pure git: no
# network access besides the `git fetch origin staging` the workflow does first.
#
# Usage:  DEPLOY_SHA=<github.sha> BEFORE_SHA=<github.event.before> \
#           bash scripts/ci-prod-deploy-guard.sh git-shape
#
# Inputs: DEPLOY_SHA (the pushed tip), BEFORE_SHA (the push's previous tip),
#         STAGING_REF (default origin/staging).
#
# ACCEPTED COMMIT SHAPES
# ======================
#   A. Console merge (the normal case). The release console calls GitHub's
#      merges API {base: main, head: <pinned staging sha>, commit_message:
#      "Release promotion (staging→main): merge into <repo> via ..."}. Result:
#      a merge commit with exactly two parents, parent 1 = the previous main
#      tip, parent 2 = a commit of staging. Accepted when ALL hold:
#        - the push added exactly one commit on main's first-parent chain
#          (BEFORE_SHA..DEPLOY_SHA --first-parent is just DEPLOY_SHA), so no
#          direct commit can ride underneath a genuine-looking merge;
#        - DEPLOY_SHA has exactly two parents and parent 1 == BEFORE_SHA;
#        - parent 2 is origin/staging's tip or an ancestor of it (equality is
#          the common case; "ancestor" covers a staging promotion landing
#          between the merge and this step, or a later re-run);
#        - the subject starts with "Release promotion (staging→main):".
#      Rejected by construction: a direct push (one parent), a dev→main PR
#      merge (parent 2 is not on staging), a squash/rebase merge (one parent),
#      a forged subject over code that never went through staging.
#   B. Fast-forward (rare, accepted). The merges API fast-forwards when main is
#      an ancestor of the head, e.g. right after a "back-merge main into
#      staging" recovery. Then main's tip IS a commit staging already carries.
#      Accepted when DEPLOY_SHA is reachable from STAGING_REF and BEFORE_SHA is
#      an ancestor of DEPLOY_SHA: only code staging already has.
#   The console's other shapes never touch main (hotfixes merge into staging
#   only; a 204 "nothing to merge" creates no commit and no push).
#
# The api repo's guard has a second `migration-head` subcommand (prod schema vs
# migration files). It does not apply to a frontend repo and is not carried
# here: this script is git-shape only.
#
set -euo pipefail

SUBJECT_PREFIX='Release promotion (staging→main):'

err() { echo "::error::$*" >&2; }

cmd_git_shape() {
  local deploy="${DEPLOY_SHA:?DEPLOY_SHA is required}"
  local before="${BEFORE_SHA:-}"
  local staging="${STAGING_REF:-origin/staging}"

  if ! git rev-parse --verify --quiet "${staging}^{commit}" >/dev/null; then
    err "prod deploy guard: ${staging} not found — cannot verify the release came from staging. Fetch it (git fetch origin staging) and re-run."
    return 1
  fi
  if [[ -z "$before" || "$before" =~ ^0+$ ]] || ! git cat-file -e "${before}^{commit}" 2>/dev/null; then
    err "prod deploy guard: push has no usable previous main tip (BEFORE_SHA='${before}') — a new/force-pushed main is not a release-console promotion. Refusing to deploy ${deploy}."
    return 1
  fi

  local subject parents p1 p2 added
  subject=$(git log -1 --format=%s "$deploy")
  # shellcheck disable=SC2207
  parents=($(git rev-list --parents -n1 "$deploy"))   # [sha, p1, p2, ...]
  p1="${parents[1]:-}"
  p2="${parents[2]:-}"
  added=$(git rev-list --first-parent "${before}..${deploy}" | wc -l | tr -d ' ')

  # Shape B: fast-forward onto a commit staging already carries.
  if git merge-base --is-ancestor "$deploy" "$staging" \
     && git merge-base --is-ancestor "$before" "$deploy"; then
    echo "OK (shape B, fast-forward): ${deploy:0:8} is already on ${staging}."
    return 0
  fi

  # Shape A: the release console's staging→main merge commit.
  if [[ "${#parents[@]}" -eq 3 && "$p1" == "$before" && "$added" == "1" \
        && "$subject" == "$SUBJECT_PREFIX"* ]] \
     && git merge-base --is-ancestor "$p2" "$staging"; then
    echo "OK (shape A, console merge): ${deploy:0:8} = merge of staging ${p2:0:8} into main ${p1:0:8}."
    return 0
  fi

  err "prod deploy guard: main tip ${deploy:0:8} is NOT a release-console staging→main promotion (parents: $(( ${#parents[@]} - 1 )), first-parent commits in this push: ${added}, parent1==previous tip: $([[ "$p1" == "$before" ]] && echo yes || echo no), parent2 on ${staging}: $([[ -n "$p2" ]] && git merge-base --is-ancestor "$p2" "$staging" && echo yes || echo no), subject: '${subject}'). A direct push or dev→main merge reaches production untested. NOT deploying. If main was pushed to by mistake, revert it and promote through the release console."
  return 1
}

case "${1:-}" in
  git-shape) cmd_git_shape ;;
  *) echo "usage: $0 git-shape" >&2; exit 2 ;;
esac
