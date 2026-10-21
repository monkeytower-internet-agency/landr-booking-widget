import { describe, expect, it } from 'vitest'
import { estimateSlotFields } from './slotKey'

// landr-k9pji.25 — the estimate carries the same slot fields as the submit line.
describe('estimateSlotFields', () => {
  it('uses the availability row id when there is one', () => {
    expect(estimateSlotFields({ availability_id: 'a-1', start_time: '07:00:00' })).toEqual({
      product_availability_id: 'a-1',
    })
  })
  it('uses the synthesised fixed time as HH:MM otherwise', () => {
    expect(estimateSlotFields({ availability_id: null, start_time: '18:30:00' })).toEqual({
      slot_start_time: '18:30',
    })
  })
  it('is empty without a slot or a time', () => {
    expect(estimateSlotFields(null)).toEqual({})
    expect(estimateSlotFields({ availability_id: null, start_time: null })).toEqual({})
  })
})
