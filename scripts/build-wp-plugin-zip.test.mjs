// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { afterAll, describe, expect, it } from 'vitest'
import { buildWpPluginZip, writeWpPluginZip } from './build-wp-plugin-zip.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(path.join(os.tmpdir(), 'wp-zip-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('build-wp-plugin-zip', () => {
  it('puts landr-booking/ at the zip root with the plugin files', () => {
    const entries = Object.keys(unzipSync(buildWpPluginZip())).sort()
    expect(entries).toEqual(['landr-booking/landr-booking.php', 'landr-booking/readme.txt'])
  })

  it('stores the real plugin contents', () => {
    const files = unzipSync(buildWpPluginZip())
    const php = readFileSync(path.join(repoRoot, 'wp-plugin/landr-booking/landr-booking.php'))
    expect(Buffer.from(files['landr-booking/landr-booking.php']).equals(php)).toBe(true)
  })

  it('is deterministic', () => {
    expect(Buffer.from(buildWpPluginZip()).equals(Buffer.from(buildWpPluginZip()))).toBe(true)
  })

  it('writes dist/downloads/landr-booking.zip', () => {
    // Reuse the real plugin sources, but write into a scratch dist.
    const fakeRoot = path.join(tmp, 'repo')
    const out = writeWpPluginZip(repoRootWith(fakeRoot))
    expect(out).toBe(path.join(fakeRoot, 'dist', 'downloads', 'landr-booking.zip'))
    expect(Object.keys(unzipSync(readFileSync(out))).length).toBe(2)
  })
})

function repoRootWith(fakeRoot) {
  cpSync(path.join(repoRoot, 'wp-plugin'), path.join(fakeRoot, 'wp-plugin'), { recursive: true })
  return fakeRoot
}
