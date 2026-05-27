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
    // landr-yybu: optional occupancyCap arg caps room-linked add-ons at the
    // room's occupancy; omitted for service-flow add-ons (uncapped beyond max_qty).
    it('clamps at 0 floor', () => {
      expect(clampAddonQty(makeAddon(), -5)).toBe(0)
    })

    it('uncapped when max_qty is null and no occupancyCap', () => {
      expect(clampAddonQty(makeAddon({ max_qty: null }), 9999)).toBe(9999)
    })

    it('caps at max_qty when set', () => {
      expect(clampAddonQty(makeAddon({ max_qty: 5 }), 10)).toBe(5)
    })

    it('caps at occupancyCap when provided (single room: cap=1)', () => {
      // The reported bug: a 1-person room must clamp breakfast to 1.
      expect(clampAddonQty(makeAddon({ max_qty: null }), 5, 1)).toBe(1)
    })

    it('caps at occupancyCap for a double room (cap=2)', () => {
      expect(clampAddonQty(makeAddon({ max_qty: null }), 5, 2)).toBe(2)
    })

    it('uses the lower of max_qty and occupancyCap', () => {
      expect(clampAddonQty(makeAddon({ max_qty: 2 }), 5, 4)).toBe(2)
      expect(clampAddonQty(makeAddon({ max_qty: 5 }), 9, 3)).toBe(3)
    })

    it('breakfast add-on with max_qty=null is NOT capped when no occupancyCap (service flow)', () => {
      // Service-flow callers pass no occupancyCap — qty stays uncapped.
      expect(clampAddonQty(makeAddon({ max_qty: null }), 5)).toBe(5)
    })

    it('breakfast add-on with max_qty set: caps at max_qty regardless of occupancy', () => {
      expect(clampAddonQty(makeAddon({ max_qty: 2 }), 5)).toBe(2)
    })

    it('generic service add-on with max_qty=null: uncapped', () => {
      expect(clampAddonQty(makeAddon({ max_qty: null }), 9999)).toBe(9999)
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

  describe('isOverbooked (landr-u4c7: occupancy-aware)', () => {
    it('returns "over" when add-on qty exceeds expectedQty', () => {
      expect(isOverbooked(3, 2)).toBe('over')
    })

    it('returns "under" when 0 < qty < expectedQty', () => {
      expect(isOverbooked(1, 2)).toBe('under')
    })

    it('returns null when qty equals expectedQty (no warning at parity)', () => {
      expect(isOverbooked(2, 2)).toBeNull()
    })

    it('returns null when qty is 0 (no warning when nothing picked)', () => {
      expect(isOverbooked(0, 2)).toBeNull()
    })

    it('returns null for Single Room x1 (expectedQty=1, qty=1)', () => {
      expect(isOverbooked(1, 1)).toBeNull()
    })

    it('returns "over" for service add-on (expectedQty=1) when qty=2', () => {
      // Preserves over-only behaviour: under never fires when expectedQty=1
      // because qty is either 0 (null) or ≥1 (null at parity, over above 1).
      expect(isOverbooked(2, 1)).toBe('over')
    })

    it('never produces "under" for service add-ons (expectedQty=1, qty=1)', () => {
      // With expectedQty=1 the under branch is unreachable in practice:
      // qty=0 → null, qty=1 → null, qty>1 → over.
      expect(isOverbooked(1, 1)).toBeNull()
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
