import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FlowAgeBand } from '@/api/flowTypes'
import { mockOccupancyStay } from '@/api/mocks'
import type { BookingSelection } from './BookingForm'
import { DetailsStep } from './DetailsStep'

// landr-zcb24.2: the party step asks age as a band the flow names.
const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-12-01', '2026-12-03'] }

/** apartment_italy: tourist tax from 10 -> the cut is below 18, so Child / Adult. */
const ITALY_BANDS: FlowAgeBand[] = [
  { key: 'child', min_age: 0, max_age: 17, label_localized: { en: 'Child' } },
  { key: 'adult', min_age: 18, max_age: null, label_localized: { en: 'Adult' } },
]
/** A senior price at 65: Child / Adult 18-64 / Senior 65+. */
const SENIOR_BANDS: FlowAgeBand[] = [
  { key: 'child', min_age: 0, max_age: 17, label_localized: { en: 'Child' } },
  { key: 'adult', min_age: 18, max_age: 64, label_localized: { en: 'Adult 18-64' } },
  { key: 'age_65_plus', min_age: 65, max_age: null, label_localized: { en: 'Senior 65+' } },
]

function byName(name: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`[name="${name}"]`)
  if (!el) throw new Error(`No input named ${name}`)
  return el
}

function setup(bands: FlowAgeBand[], extra: Partial<Parameters<typeof DetailsStep>[0]> = {}) {
  const onConfirm = vi.fn()
  render(
    <DetailsStep
      product={{ ...mockOccupancyStay, occupancy_pricing: undefined }}
      selection={SELECTION}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      collectGuestAges
      ageNeeded
      ageBands={bands}
      {...extra}
    />,
  )
  fireEvent.change(byName('booker_first_name'), { target: { value: 'Ada' } })
  fireEvent.change(byName('booker_last_name'), { target: { value: 'Lovelace' } })
  fireEvent.change(byName('booker_email'), { target: { value: 'ada@example.com' } })
  fireEvent.change(byName('booker_phone'), { target: { value: '+34 600 000 000' } })
  return onConfirm
}

const CHILDREN = Array.from({ length: 18 }, (_, a) => `Child, ${a} year${a === 1 ? '' : 's'} old`)
const options = (testId: string) =>
  Array.from(screen.getByTestId(testId).querySelectorAll('option')).map((o) => o.textContent)

describe('DetailsStep age bands (landr-zcb24.2)', () => {
  it('apartment_italy shape: Child / Adult look, booker has no band select and no 18+ tick', () => {
    const onConfirm = setup(ITALY_BANDS)
    fireEvent.click(screen.getByTestId('add-participant'))
    expect(options('guest-age-band-2')).toEqual(['Adult', ...CHILDREN])
    // one adult band: the booker gets no select, only the confirmation
    expect(screen.queryByTestId('guest-age-band-booker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('booker-adult-confirm')).not.toBeInTheDocument()
    expect(screen.getByTestId('booker-adult-notice')).toHaveTextContent("By booking, you confirm you're at least 18.")

    fireEvent.change(byName('participant_2_first_name'), { target: { value: 'Tim' } })
    fireEvent.change(byName('participant_2_last_name'), { target: { value: 'Lovelace' } })
    fireEvent.change(byName('participant_2_phone'), { target: { value: '+34 600 000 001' } })
    fireEvent.change(screen.getByTestId('guest-age-band-2'), { target: { value: 'c:8' } })

    // no tick needed: the booker is assumed an adult
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [booker, participants] = onConfirm.mock.calls[0]
    expect(booker.adult_confirmed).toBeUndefined()
    // the booker is the first row: an adult, stored as the band floor
    expect(participants[0]).toMatchObject({
      first_name: 'Ada',
      occupant_age_band: 'adult',
      occupant_age: 18,
      guest_attributes: { _inexact: ['age'] },
    })
    // the child keeps its exact age and no floor flag
    expect(participants[1]).toMatchObject({ first_name: 'Tim', occupant_age_band: 'child', occupant_age: 8 })
    expect(participants[1].guest_attributes?._inexact).toBeUndefined()
  })

  it('senior band flow: guests pick Senior 65+, stored as 65 with age in _inexact', () => {
    const onConfirm = setup(SENIOR_BANDS)
    fireEvent.click(screen.getByTestId('add-participant'))
    expect(options('guest-age-band-2')).toEqual(['Adult 18-64', 'Senior 65+', ...CHILDREN])
    fireEvent.change(byName('participant_2_first_name'), { target: { value: 'Grace' } })
    fireEvent.change(byName('participant_2_last_name'), { target: { value: 'Hopper' } })
    fireEvent.change(byName('participant_2_phone'), { target: { value: '+34 600 000 001' } })
    fireEvent.change(screen.getByTestId('guest-age-band-2'), { target: { value: 'a:age_65_plus' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const participants = onConfirm.mock.calls[0][1]
    expect(participants[1]).toMatchObject({
      occupant_age_band: 'adult',
      occupant_age: 65,
      guest_attributes: { _inexact: ['age'] },
    })
    // an untouched guest and the booker sit in the first adult band
    expect(participants[0]).toMatchObject({ occupant_age: 18 })
  })

  it('the booker cannot be a child: adult options only, never Child', () => {
    const onConfirm = setup(SENIOR_BANDS)
    expect(options('guest-age-band-booker')).toEqual(['Adult 18-64', 'Senior 65+'])
    fireEvent.change(screen.getByTestId('guest-age-band-booker'), { target: { value: 'a:age_65_plus' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm.mock.calls[0][1][0]).toMatchObject({
      occupant_age_band: 'adult',
      occupant_age: 65,
      guest_attributes: { _inexact: ['age'] },
    })
  })

  it('a booker who does not take part has no 18+ tick and no band select', () => {
    setup(SENIOR_BANDS)
    fireEvent.click(screen.getByTestId('booker-not-joining-toggle'))
    expect(screen.queryByTestId('booker-adult-confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('guest-age-band-booker')).not.toBeInTheDocument()
  })

  it('companions get the same band control and are stamped', () => {
    const onConfirm = setup(SENIOR_BANDS, {
      product: { ...mockOccupancyStay, occupancy_pricing: undefined, product_kind: 'service', hotel_offering: 'optional' },
    })
    fireEvent.click(screen.getByTestId('add-companion'))
    expect(options('guest-age-band-companion-0')).toEqual(['Adult 18-64', 'Senior 65+', ...CHILDREN])
    fireEvent.change(byName('companion_1_first_name'), { target: { value: 'Tom' } })
    fireEvent.change(byName('companion_1_last_name'), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByTestId('guest-age-band-companion-0'), { target: { value: 'a:age_65_plus' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm.mock.calls[0][2][0]).toMatchObject({
      occupant_age: 65,
      guest_attributes: { _inexact: ['age'] },
    })
  })

  it('Adult / Child only (landr-zcb24.31): a companion gets the age select', () => {
    const onConfirm = setup([], {
      ageNeeded: false,
      product: { ...mockOccupancyStay, occupancy_pricing: undefined, product_kind: 'service', hotel_offering: 'optional' },
    })
    fireEvent.click(screen.getByTestId('add-companion'))
    expect(options('guest-age-band-companion-0')).toEqual(['Adult', ...CHILDREN])
    fireEvent.change(byName('companion_1_first_name'), { target: { value: 'Tom' } })
    fireEvent.change(byName('companion_1_last_name'), { target: { value: 'Hopper' } })
    fireEvent.change(screen.getByTestId('guest-age-band-companion-0'), { target: { value: 'c:9' } })

    // every choice is complete: no age error, Continue goes through
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][2][0]).toMatchObject({ occupant_age_band: 'child', occupant_age: 9 })
  })

  it('Adult / Child only: an untouched companion is stamped an adult', () => {
    const onConfirm = setup([], {
      ageNeeded: false,
      product: { ...mockOccupancyStay, occupancy_pricing: undefined, product_kind: 'service', hotel_offering: 'optional' },
    })
    fireEvent.click(screen.getByTestId('add-companion'))
    fireEvent.change(byName('companion_1_first_name'), { target: { value: 'Tom' } })
    fireEvent.change(byName('companion_1_last_name'), { target: { value: 'Hopper' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm.mock.calls[0][2][0]).toMatchObject({ occupant_age_band: 'adult' })
    expect(onConfirm.mock.calls[0][2][0].occupant_age).toBeFalsy()
  })

  it('shows no age UI, no 18+ box and stamps nothing when the cart asks no age', () => {
    const onConfirm = setup(ITALY_BANDS, { collectGuestAges: false, ageNeeded: false })
    expect(screen.queryByTestId('booker-adult-confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('booker-adult-notice')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm.mock.calls[0][1][0].occupant_age).toBeUndefined()
  })

  it('exact age (landr-zcb24.7): one Adult / Child select per guest, the booker an adult, nothing flagged', () => {
    const onConfirm = setup([], { ageExact: true })
    fireEvent.click(screen.getByTestId('add-participant'))
    // no bands, no 18+ tick, no control for the booker
    expect(screen.queryByTestId('guest-age-band-booker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('booker-adult-confirm')).not.toBeInTheDocument()
    expect(options('guest-age-band-2')).toEqual(['Adult', ...CHILDREN])

    fireEvent.change(byName('participant_2_first_name'), { target: { value: 'Tim' } })
    fireEvent.change(byName('participant_2_last_name'), { target: { value: 'Lovelace' } })
    fireEvent.change(byName('participant_2_phone'), { target: { value: '+34 600 000 001' } })
    fireEvent.change(screen.getByTestId('guest-age-band-2'), { target: { value: 'c:8' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const participants = onConfirm.mock.calls[0][1]
    expect(participants[0]).toMatchObject({ occupant_age_band: 'adult' })
    expect(participants[0].guest_attributes?._inexact).toBeUndefined()
    expect(participants[1]).toMatchObject({ occupant_age_band: 'child', occupant_age: 8 })
  })

  it('exact age: a booker who does not take part gets no box and no field, and companions pick an age', () => {
    setup([], {
      ageExact: true,
      product: { ...mockOccupancyStay, occupancy_pricing: undefined, product_kind: 'service', hotel_offering: 'optional' },
    })
    fireEvent.click(screen.getByTestId('add-companion'))
    expect(screen.getByTestId('guest-age-band-companion-0')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('booker-not-joining-toggle'))
    expect(screen.queryByTestId('guest-age-booker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('booker-adult-confirm')).not.toBeInTheDocument()
  })
})
