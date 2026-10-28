#!/usr/bin/env python3
"""Helpers for the dependency-audit workflow.

  osv_gate.py report HEAD.json           print HIGH/CRITICAL findings, write
                                         `count` + `packages` to $GITHUB_OUTPUT
  osv_gate.py new HEAD.json BASE.json    exit 1 when HEAD has a HIGH/CRITICAL
                                         finding that BASE does not have
"""
import json
import os
import sys

THRESHOLD = 7.0


def findings(path):
    """Return {key: (score, name, version, ids)} for CVSS >= 7.0 groups."""
    data = json.load(open(path))
    out = {}
    for res in data.get("results", []):
        for pkg in res.get("packages", []):
            p = pkg["package"]
            for g in pkg.get("groups", []):
                try:
                    score = float(g.get("max_severity") or 0)
                except ValueError:
                    score = 0.0
                if score >= THRESHOLD:
                    ids = ",".join(sorted(g["ids"]))
                    out[f"{p['name']}@{p['version']}:{ids}"] = (score, p["name"], p["version"], ids)
    return out


def emit(rows, level):
    for s, n, v, ids in sorted(rows, reverse=True):
        print(f"::{level}::HIGH/CRITICAL {s}: {n}@{v} {ids}")


def main(argv):
    cmd = argv[1]
    head = findings(argv[2])
    if cmd == "report":
        emit(head.values(), "warning")
        names = sorted({n for _, n, _, _ in head.values()})
        print(f"{len(head)} un-ignored HIGH/CRITICAL advisories in {len(names)} packages.")
        out = os.environ.get("GITHUB_OUTPUT")
        if out:
            with open(out, "a") as fh:
                fh.write(f"count={len(head)}\npackages={' '.join(names)}\n")
        return 0
    if cmd == "new":
        base = findings(argv[3])
        fresh = [v for k, v in head.items() if k not in base]
        emit(fresh, "error")
        if fresh:
            print(f"{len(fresh)} HIGH/CRITICAL advisories are new in this PR (not present on the base "
                  "branch). Pick a patched version, or add an [[IgnoredVulns]] entry with reason + "
                  "ignoreUntil to osv-scanner.toml.")
            return 1
        print("This PR adds no new HIGH/CRITICAL advisories.")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
