import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import { slotPartyCap, withSlotPartyCap } from './slotPartyCap'

function slot(over: Partial<AvailabilitySlot> = {}): BookingSelection {
  return {
    kind: 'slot',
    slot: {
      availability_id: null,
      date: '2026-12-10',
      start_time: '10:00:00',
      end_time: '11:30:00',
      capacity: 2,
      capacity_reserved: 0,
      available_seats: 1,
      status: 'open',
      seat_limit_source: 'resources',
      ...over,
    },
  }
}

describe('slotPartyCap (landr-v56gf)', () => {
  it('caps the party at the pilots free in the slot', () => {
    expect(slotPartyCap({ max_party_size: 2 }, slot())).toBe(1)
    expect(withSlotPartyCap({ max_party_size: 2 }, slot()).max_party_size).toBe(1)
  })

  it('keeps max_party_size when the slot has room for it', () => {
    const product = { max_party_size: 2 }
    expect(slotPartyCap(product, slot({ available_seats: 2 }))).toBeNull()
    expect(withSlotPartyCap(product, slot({ available_seats: 2 }))).toBe(product)
  })

  it('uses the default party cap when the product sets none', () => {
    expect(slotPartyCap({ max_party_size: null }, slot({ available_seats: 3 }))).toBe(3)
    expect(slotPartyCap({ max_party_size: null }, slot({ available_seats: 8 }))).toBeNull()
  })

  it('leaves product-capped, whole-day, unlimited and non-slot picks alone', () => {
    const p = { max_party_size: 4 }
    expect(slotPartyCap(p, slot({ seat_limit_source: 'product' }))).toBeNull()
    expect(slotPartyCap(p, slot({ end_time: null }))).toBeNull()
    expect(slotPartyCap(p, slot({ start_time: null }))).toBeNull()
    expect(slotPartyCap(p, slot({ available_seats: 9999 }))).toBeNull()
    expect(slotPartyCap(p, slot({ available_seats: 0 }))).toBeNull()
    expect(slotPartyCap(p, { kind: 'days', selectedDays: ['2026-12-10'] } as BookingSelection)).toBeNull()
    expect(slotPartyCap(p, undefined)).toBeNull()
  })
})
