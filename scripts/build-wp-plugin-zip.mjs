// Zips wp-plugin/landr-booking/ into dist/downloads/landr-booking.zip so every
// widget host (Firebase Hosting, Cloudflare Pages) serves the WordPress plugin
// next to the widget itself. Pure Node (fflate) — no `zip` CLI needed on CI.
//
// WordPress requires the plugin folder (`landr-booking/`) at the zip root.
// Output is deterministic: sorted entries, fixed mtime, fixed compression level.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_SLUG = 'landr-booking'
const FIXED_MTIME = new Date(2020, 0, 1, 0, 0, 0)

function listFiles(dir, prefix) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

/** Build the zip bytes for the plugin folder under `repoRoot`. */
export function buildWpPluginZip(repoRoot = root) {
  const pluginDir = path.join(repoRoot, 'wp-plugin', PLUGIN_SLUG)
  const names = listFiles(pluginDir, PLUGIN_SLUG).sort()
  const files = {}
  for (const name of names) {
    files[name] = [
      readFileSync(path.join(repoRoot, 'wp-plugin', name)),
      { level: 9, mtime: FIXED_MTIME },
    ]
  }
  return zipSync(files)
}

/** Write the zip to `<repoRoot>/dist/downloads/landr-booking.zip`; returns the path. */
export function writeWpPluginZip(repoRoot = root) {
  const outDir = path.join(repoRoot, 'dist', 'downloads')
  mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `${PLUGIN_SLUG}.zip`)
  writeFileSync(outFile, buildWpPluginZip(repoRoot))
  return outFile
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`wrote ${path.relative(root, writeWpPluginZip())}`)
}
