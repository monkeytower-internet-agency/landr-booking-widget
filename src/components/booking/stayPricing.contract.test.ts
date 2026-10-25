/**
 * Standalone stays: the widget's stay arithmetic (accommodationCalc.ts) runs
 * the SAME fixtures as the API's pure module (landr-api
 * app/services/stay_pricing.py). contracts/stay_pricing_fixtures.json is a
 * byte-identical copy of the API's app/services/stay_pricing_fixtures.json;
 * both sides pin its SHA-256, so a fixture edit on one side fails the other
 * side's suite until the copy is synced.
 */
import { describe, expect, it } from 'vitest'
import {
  addonUnits,
  checkStayRange,
  nightsBetween,
  quoteStay,
} from './accommodationCalc'

// The app tsconfig carries no @types/node, so Node's builtins are reached the
// way widgetTheme.test.ts does (vitest runs from the repo root).
const nodeProcess = (
  globalThis as unknown as {
    process: {
      cwd(): string
      getBuiltinModule(id: 'node:fs'): { readFileSync(p: string): Uint8Array & { toString(enc: 'utf8'): string } }
      getBuiltinModule(id: 'node:crypto'): {
        createHash(alg: 'sha256'): { update(data: Uint8Array): { digest(enc: 'hex'): string } }
      }
    }
  }
).process
const RAW = nodeProcess
  .getBuiltinModule('node:fs')
  .readFileSync(`${nodeProcess.cwd()}/contracts/stay_pricing_fixtures.json`)
const sha256 = (data: Uint8Array) =>
  nodeProcess.getBuiltinModule('node:crypto').createHash('sha256').update(data).digest('hex')
/** Must equal the SHA-256 the API test pins (test_stay_pricing.py). */
const FIXTURE_SHA256 = '833c5cb5a2838c93504c2584f5519be767a6ba461b494c24a056bcd2c891e340'

interface Fixtures {
  addon_units: Array<{ price_unit: string; nights: number; guests: number; expected: number }>
  quotes: Array<{
    name: string
    input: {
      check_in: string
      check_out: string
      nightly_price_cents: number | number[]
      cleaning_fee_cents: number
      guests: number
      addons: Array<{ key: string; unit_price_cents: number; price_unit: string; quantity: number }>
    }
    expected: unknown
  }>
  ranges: Array<{
    name: string
    input: {
      check_in: string
      check_out: string
      min_nights: number
      max_nights: number | null
      guests: number
      capacity: number | null
      today: string
      blocked: string[]
      unavailable: string[]
    }
    expected: unknown
  }>
}

const FIXTURES = JSON.parse(RAW.toString('utf8')) as Fixtures

describe('stay pricing contract (shared fixtures)', () => {
  it('pins the fixture file the API pins', () => {
    expect(sha256(RAW)).toBe(FIXTURE_SHA256)
  })

  it.each(FIXTURES.addon_units)('addonUnits($price_unit, $nights, $guests)', (c) => {
    expect(addonUnits(c.price_unit, c.nights, c.guests)).toBe(c.expected)
  })

  it.each(FIXTURES.quotes)('quoteStay: $name', (c) => {
    const nights = nightsBetween(c.input.check_in, c.input.check_out).length
    expect(
      quoteStay({
        nights,
        nightly_price_cents: c.input.nightly_price_cents,
        cleaning_fee_cents: c.input.cleaning_fee_cents,
        guests: c.input.guests,
        addons: c.input.addons,
      }),
    ).toEqual(c.expected)
  })

  it.each(FIXTURES.ranges)('checkStayRange: $name', (c) => {
    expect(checkStayRange(c.input)).toEqual(c.expected)
  })

  it('nightsBetween is check-in inclusive, check-out exclusive', () => {
    expect(nightsBetween('2031-06-29', '2031-07-02')).toEqual([
      '2031-06-29',
      '2031-06-30',
      '2031-07-01',
    ])
    expect(nightsBetween('2031-07-02', '2031-07-02')).toEqual([])
  })
})
