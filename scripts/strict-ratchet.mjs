#!/usr/bin/env node
// landr-0ji4.2 — TypeScript strict-mode error ratchet.
//
// tsconfig.app.json intentionally does NOT set "strict": true — the normal
// build (`npm run typecheck` / `tsc -b`) stays on the relaxed config so it
// can never regress. This script runs a SEPARATE strict-mode check against
// the same project (tsconfig.app.json + `--strict`) and compares the error
// count to a checked-in baseline (strict-baseline.json). CI fails only if
// the count goes UP; a decrease is fine (encouraged).
//
// Shrink-on-touch rule: if a file you're already editing loses strict-mode
// errors as a side effect, run `npm run typecheck:strict:update` in the same
// PR to shrink the baseline. See README for details.
//
// Generated files (src/types/*.gen.ts, landr-y3oj.2) are excluded from the
// count — they're machine-generated from OpenAPI/Postgres schemas and
// happen to be strict-clean today, but excluding them keeps this ratchet
// from swinging on unrelated codegen regen.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const BASELINE_FILE = path.join(REPO_ROOT, "strict-baseline.json");
const EXCLUDE = [/\/src\/types\/.*\.gen\.ts$/];

const update = process.argv.includes("--update");

let output = "";
try {
  execFileSync(
    "npx",
    ["tsc", "-p", "tsconfig.app.json", "--strict", "--noEmit", "--pretty", "false"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
} catch (err) {
  // tsc exits non-zero when there are type errors; stdout still has the list.
  output = err.stdout ?? "";
}

const errors = output
  .split("\n")
  .filter((line) => /error TS\d+/.test(line))
  .filter((line) => !EXCLUDE.some((re) => re.test(line.split("(")[0].replace(/\\/g, "/"))));

const count = errors.length;
const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8")).maxErrors;

if (update) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ maxErrors: count }, null, 2) + "\n");
  console.log(`strict-ratchet: baseline updated to ${count} (was ${baseline}).`);
  process.exit(0);
}

console.log(`strict-ratchet: ${count} strict-mode error(s), baseline ${baseline}.`);
if (count > baseline) {
  console.log(`strict-ratchet: FAIL - ${count - baseline} new strict-mode error(s) introduced.`);
  console.log(errors.join("\n"));
  process.exit(1);
}
if (count < baseline) {
  console.log(
    `strict-ratchet: count decreased by ${baseline - count} - run 'npm run typecheck:strict:update' to shrink the baseline.`
  );
}
process.exit(0);
