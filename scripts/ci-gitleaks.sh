#!/usr/bin/env bash
# landr-0unqx.1 — pinned gitleaks runner, one copy per repo (identical in all of them).
# No gitleaks-action (needs a paid licence for orgs): the release tarball is downloaded once
# into a cache dir and verified against the sha256 pinned below before it is ever executed.
#
#   scripts/ci-gitleaks.sh history   full-history scan of the checkout (CI; needs fetch-depth: 0)
#   scripts/ci-gitleaks.sh staged    scan staged changes only (pre-commit hook)
#
# Config: .gitleaks.toml (rules + allowlists) and .gitleaksignore (baseline fingerprints) in the
# repo root, both picked up automatically. To bump: change VERSION and the three sums together.
set -euo pipefail

VERSION=8.21.2
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   ASSET=linux_x64;    SHA=5bc41815076e6ed6ef8fbecc9d9b75bcae31f39029ceb55da08086315316e3ba ;;
  Darwin-arm64)   ASSET=darwin_arm64; SHA=cad3de5dc9a4d5447d967a70a4d49499c557f04db028274cc324f9ff983f6502 ;;
  Darwin-x86_64)  ASSET=darwin_x64;   SHA=5b42c6e4b1fd693eaeb2b5b7faa5f17a1434299d4deb2de63d4b2efd7c753128 ;;
  *) echo "ci-gitleaks: unsupported platform $(uname -sm)" >&2; exit 2 ;;
esac

cache="${GITLEAKS_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/gitleaks-$VERSION}"
bin="$cache/gitleaks"
if [ ! -x "$bin" ]; then
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  tgz="gitleaks_${VERSION}_${ASSET}.tar.gz"
  curl -fsSL --retry 3 -o "$tmp/$tgz" "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${tgz}"
  if command -v sha256sum >/dev/null; then got="$(sha256sum "$tmp/$tgz" | cut -d' ' -f1)"
  else got="$(shasum -a 256 "$tmp/$tgz" | cut -d' ' -f1)"; fi
  [ "$got" = "$SHA" ] || { echo "ci-gitleaks: sha256 mismatch for $tgz (got $got)" >&2; exit 2; }
  mkdir -p "$cache"
  tar -xzf "$tmp/$tgz" -C "$tmp" gitleaks
  mv "$tmp/gitleaks" "$bin"
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"
case "${1:-history}" in
  history) exec "$bin" git "$root" --redact --no-banner --exit-code 1 ;;
  staged)  exec "$bin" git "$root" --pre-commit --staged --redact --no-banner --exit-code 1 ;;
  *) echo "usage: $0 history|staged" >&2; exit 2 ;;
esac
