import { describe, expect, it } from 'vitest'

import type { ProductAddon } from '@/api/types'
import {
  clampAddonQty,
  defaultAddonQty,
  isOverbooked,
  requiredAddonError,
  selectionToLines,
} from './addonsState'

function makeAddon(overrides: Partial<ProductAddon> = {}): ProductAddon {
  return {
    product_addon_id: 'pa-1',
    addon_product_id: 'addon-1',
    name: 'Breakfast',
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 10,
    price_per_unit: 10,
    currency: 'EUR',
    ...overrides,
  }
}

describe('addonsState (landr-cip6)', () => {
  describe('defaultAddonQty', () => {
    it('returns 0 for non-required add-ons', () => {
      expect(defaultAddonQty(makeAddon())).toBe(0)
    })

    it('returns at least 1 for required add-ons with min_qty=0', () => {
      // is_required + min_qty=0 is forbidden by the DB CHECK, but the
      // client guards defensively in case data drifts.
      expect(
        defaultAddonQty(makeAddon({ is_required: true, min_qty: 0 })),
      ).toBe(1)
    })

    it('returns min_qty for required add-ons with min_qty >= 1', () => {
      expect(
        defaultAddonQty(makeAddon({ is_required: true, min_qty: 3 })),
      ).toBe(3)
    })
  })

  describe('clampAddonQty', () => {
    it('clamps at 0 floor', () => {
      expect(clampAddonQty(makeAddon(), -5)).toBe(0)
    })

    it('uncapped when max_qty is null', () => {
      expect(clampAddonQty(makeAddon({ max_qty: null }), 9999)).toBe(9999)
    })

    it('caps at max_qty when set', () => {
      expect(clampAddonQty(makeAddon({ max_qty: 5 }), 10)).toBe(5)
    })
  })

  describe('requiredAddonError', () => {
    it('returns null for non-required add-ons regardless of qty', () => {
      expect(requiredAddonError(makeAddon(), 0)).toBeNull()
      expect(requiredAddonError(makeAddon(), 999)).toBeNull()
    })

    it('returns Required when required and qty < min_qty', () => {
      expect(
        requiredAddonError(makeAddon({ is_required: true, min_qty: 1 }), 0),
      ).toBe('Required')
    })

    it('mentions the minimum when min_qty > 1', () => {
      expect(
        requiredAddonError(makeAddon({ is_required: true, min_qty: 3 }), 1),
      ).toMatch(/at least 3/)
    })

    it('returns null when required and qty meets min', () => {
      expect(
        requiredAddonError(makeAddon({ is_required: true, min_qty: 2 }), 2),
      ).toBeNull()
    })
  })

  describe('isOverbooked', () => {
    it('flags add-on qty greater than parent qty', () => {
      expect(isOverbooked(3, 2)).toBe(true)
    })

    it('does not flag equal qty (no warning at parity)', () => {
      expect(isOverbooked(2, 2)).toBe(false)
    })

    it('does not flag zero qty (no warning when nothing picked)', () => {
      expect(isOverbooked(0, 2)).toBe(false)
    })
  })

  describe('selectionToLines', () => {
    it('drops zero-qty entries and shapes the rest', () => {
      const lines = selectionToLines({
        addon_a: 0,
        addon_b: 2,
        addon_c: 5,
      })
      expect(lines).toEqual(
        expect.arrayContaining([
          { productId: 'addon_b', quantity: 2 },
          { productId: 'addon_c', quantity: 5 },
        ]),
      )
      expect(lines).toHaveLength(2)
    })

    it('returns empty for an empty selection', () => {
      expect(selectionToLines({})).toEqual([])
    })
  })
})
