// @vitest-environment node
// (Web Crypto's subtle.digest is Node's; jsdom does not provide it.)
/**
 * landr-tm48v.2 — the TS evaluator runs the SAME fixture as landr-api's SQL
 * and Python evaluators. The fixture is a verbatim copy of landr-api
 * app/tests/fixtures/offer_rules_cases.json; both repos pin its sha256 in
 * offer_rules_cases.sha256, so an edit on one side only fails here.
 */
import { describe, expect, it } from 'vitest'
import raw from './__fixtures__/offerRules.cases.json?raw'
import pin from './__fixtures__/offer_rules_cases.sha256?raw'
import { missingAttributeKeys, requiredAttributeKeys, ruleKeys, ruleMatches } from './offerRules'

interface MatchCase {
  name: string
  rules: unknown
  ctx: unknown
  expected: boolean
}

interface KeyCase {
  name: string
  rules: unknown
  expected: string[]
}

const fixture = JSON.parse(raw) as { matches: MatchCase[]; keys: KeyCase[] }

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('offer rule fixture', () => {
  it('is the pinned copy of landr-api offer_rules_cases.json', async () => {
    expect(await sha256(raw)).toBe(pin.trim().split(/\s+/)[0])
  })

  it('carries the cases DECIDED names', () => {
    const names = new Set(fixture.matches.map((c) => c.name))
    expect(fixture.matches.length).toBeGreaterThanOrEqual(25)
    expect(names.size).toBe(fixture.matches.length)
    for (const name of [
      'winter wrap Dec 30 - Jan 2',
      'gte boundary: age 9 vs gte 10',
      'gte boundary: age 10 vs gte 10',
      'DST spring stay Mar 27-30 vs window from 03-28',
      'missing key never matches',
      'empty items',
      'unknown cond never',
    ]) {
      expect(names.has(name), name).toBe(true)
    }
  })
})

describe('ruleMatches', () => {
  it.each(fixture.matches.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(ruleMatches(c.rules, c.ctx)).toBe(c.expected)
  })
})

describe('ruleKeys', () => {
  it.each(fixture.keys.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(ruleKeys(c.rules)).toEqual(c.expected)
  })
})

describe('every-guest attributes and arrival-anchored windows', () => {
  it('carries the cases', () => {
    const names = new Set(fixture.matches.map((c) => c.name))
    for (const name of [
      'guest_attr_all: every guest matches',
      'guest_attr_all: one guest missing the key',
      'guest_attr_all: one guest fails (adult with an 8-year-old vs gte 10)',
      'guest_attr_all: empty party never matches',
      'date_window arrival anchor: Oct 31 arrival into November matches',
      'date_window arrival anchor: Nov 1 arrival fails',
      'date_window arrival anchor wrap: Feb 28 arrival into March matches',
      'date_window arrival anchor wrap: Nov 30 arrival into December fails',
    ]) {
      expect(names.has(name), name).toBe(true)
    }
  })

  it('asks for a key only a guest_attr_all item reads', () => {
    const eligibility = { mode: 'all', items: [{ cond: 'guest_attr_all', key: 'age', op: 'gte', value: 10 }] }
    expect(requiredAttributeKeys({ eligibility_rules: eligibility }, [])).toEqual(['age'])
  })
})

describe('attribute keys', () => {
  const age = { cond: 'guest_attr', key: 'age', op: 'gte', value: 10 }

  it('unions required and rule-read keys, sorted', () => {
    expect(
      requiredAttributeKeys(
        { required_attributes: ['shoe_size_eu'], eligibility_rules: { mode: 'all', items: [age] } },
        [
          { required_attributes: ['weight_kg'], rules: { mode: 'all', items: [] } },
          { rules: { mode: 'any', items: [{ cond: 'guest_attr', key: 'height_cm', op: 'lte', value: 200 }, 'junk'] } },
        ],
        ['clothing_size', 'Bad Key'],
      ),
    ).toEqual(['age', 'clothing_size', 'height_cm', 'shoe_size_eu', 'weight_kg'])
    expect(requiredAttributeKeys(null, [])).toEqual([])
  })

  it('reports keys a guest has not answered', () => {
    const party = (...ages: (number | null)[]) => ({
      participants: ages.map((a) => ({ guest_attributes: a === null ? {} : { age: a } })),
    })
    expect(missingAttributeKeys(['age'], party(8, 12))).toEqual([])
    expect(missingAttributeKeys(['age'], party(8, null))).toEqual(['age'])
    expect(missingAttributeKeys(['age'], { participants: [] })).toEqual(['age'])
  })
})
