import { describe, expect, it } from 'vitest'
import type { ProductGroup } from '../api/types'
import { limitGroups, parseGroupParam, singleGroup } from './groupParam'

const g = (slug: string, parent_id: string | null = null): ProductGroup =>
  ({ id: `id-${slug}`, slug, name: slug, parent_id, product_count: 1 }) as ProductGroup
const ALL = [g('a'), g('b'), g('c'), g('c1', 'id-c')]

describe('parseGroupParam', () => {
  it('splits, trims, dedupes, drops empties', () => {
    expect(parseGroupParam(' a, b ,,a')).toEqual(['a', 'b'])
    expect(parseGroupParam(null)).toEqual([])
    expect(parseGroupParam('')).toEqual([])
  })
  it('single value locks as today', () => {
    expect(singleGroup(parseGroupParam('a'))).toBe('a')
    expect(singleGroup(parseGroupParam('a,'))).toBe('a')
    expect(singleGroup(parseGroupParam('a,b'))).toBeNull()
  })
})

describe('limitGroups', () => {
  it('limits to listed slugs or ids', () => {
    expect(limitGroups(ALL, ['a', 'id-b']).map((x) => x.slug)).toEqual(['a', 'b'])
  })
  it('ignores unknown values', () => {
    expect(limitGroups(ALL, ['a', 'nope', 'b']).map((x) => x.slug)).toEqual(['a', 'b'])
  })
  it('all unknown -> unscoped', () => {
    expect(limitGroups(ALL, ['x', 'y'])).toBe(ALL)
  })
  it('keeps sub-categories of a listed group', () => {
    expect(limitGroups(ALL, ['a', 'c']).map((x) => x.slug)).toEqual(['a', 'c', 'c1'])
  })
  it('one token is not a limited set', () => {
    expect(limitGroups(ALL, ['a'])).toBe(ALL)
  })
})
