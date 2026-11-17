import { describe, expect, it } from 'vitest'
import { taxedGuestsLine } from './taxedGuests'
import { partyMembers } from './offerCart'

const members = partyMembers(
  [{ id: 'o', first_name: 'Olaf' }],
  [
    { id: 'm', first_name: 'Matthias', occupant_age_band: 'child', occupant_age: 7 },
    { id: 'a', first_name: 'Alyda Maria', occupant_age_band: 'child', occupant_age: 12 },
  ],
)

describe('taxedGuestsLine (landr-zorj8)', () => {
  it('names who the band counted', () => {
    const summary = { attribute_key: 'age', bands: [{ min: 10, max: null, guests: 2 }] }
    expect(taxedGuestsLine(summary, members, 'en')).toBe(
      '2 guests from 10 · Olaf (adult), Alyda Maria (12)',
    )
    expect(taxedGuestsLine(summary, members, 'de')).toBe(
      '2 Gäste ab 10 · Olaf (Erwachsener), Alyda Maria (12)',
    )
  })

  it('says nothing for other attributes or when nobody was counted', () => {
    expect(taxedGuestsLine({ attribute_key: 'weight_kg', bands: [] }, members, 'en')).toBeNull()
    expect(taxedGuestsLine({ attribute_key: 'age', bands: [{ min: 40, max: null, guests: 0 }] }, members, 'en')).toBeNull()
    expect(taxedGuestsLine(undefined, members, 'en')).toBeNull()
  })
})
