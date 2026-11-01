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
import { missingAttributeKeys, requiredAttributeKeys, ruleMatches } from './offerRules'

interface MatchCase {
  name: string
  rules: unknown
  ctx: unknown
  expected: boolean
}

const fixture = JSON.parse(raw) as { matches: MatchCase[] }

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
