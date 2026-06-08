/**
 * landr-aoak.2 [S3]: staff force-book on FixedDateWindowPicker. A FULL window
 * (capacity == reserved) becomes selectable inside an active StaffModeProvider
 * and confirms via onConfirm(slot, window, forced=true). Normal-mode behaviour
 * is covered by FixedDateWindowPicker.test.tsx (untouched).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixedDateWindow, Product } from '@/api/types'
import { FixedDateWindowPicker } from './FixedDateWindowPicker'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getFixedDateWindows: mocks.getFixedDateWindows,
}))

const STAFF: StaffSession = {
  active: true,
  token: 'staff.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'op-uuid-1',
}

function makeProduct(): Product {
  return {
    product_id: 'p-1',
    slug: 'siv-course',
    name: 'SIV Course',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'fixed_window',
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
  }
}

const FULL_WINDOW: FixedDateWindow = {
  id: 'w-full',
  start_date: '2027-08-04',
  end_date: '2027-08-10',
  capacity: 8,
  capacity_reserved: 8,
}

function renderStaff(onConfirm = vi.fn()) {
  render(
    <StaffModeProvider value={STAFF}>
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />
    </StaffModeProvider>,
  )
  return onConfirm
}

describe('FixedDateWindowPicker — staff force-book', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFixedDateWindows.mockResolvedValue([FULL_WINDOW])
  })
  afterEach(() => vi.restoreAllMocks())

  it('a FULL window is selectable in staff mode and confirms with forced=true', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderStaff()

    await waitFor(() => expect(screen.getByText(/Aug 4, 2027/)).toBeInTheDocument())
    // Override badge replaces the dead "Full" chip in staff mode.
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()

    // The row button is not disabled in staff mode.
    const rowBtn = screen.getByRole('button', { name: /Aug 4, 2027/ })
    expect(rowBtn).not.toBeDisabled()
    fireEvent.click(rowBtn)
    expect(window.confirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [, windowArg, forced] = onConfirm.mock.calls[0]!
    expect(windowArg.id).toBe('w-full')
    expect(forced).toBe(true)
  })

  it('declining the confirm does not select the full window', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderStaff()
    await waitFor(() => expect(screen.getByText(/Aug 4, 2027/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Aug 4, 2027/ }))
    // Continue stays disabled — nothing selected.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})
