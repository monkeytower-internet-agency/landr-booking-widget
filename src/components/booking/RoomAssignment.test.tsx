import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RoomAssignment } from './RoomAssignment'
import type { RoomAssignmentMap, RoomUnit } from './accommodationCalc'

const UNITS: RoomUnit[] = [
  { roomProductId: 'double', unitIndex: 0, capacity: 2, roomName: 'Double Room' },
  { roomProductId: 'double', unitIndex: 1, capacity: 2, roomName: 'Double Room' },
]

const NAMES = ['Ada', 'Grace', 'Linus']

describe('RoomAssignment (landr-gb2f.2)', () => {
  it('renders unassigned chips for participants with no assignment', () => {
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={{}}
        onAssign={vi.fn()}
      />,
    )
    // 3 unassigned chips, tray count reflects it.
    expect(screen.getByTestId('unassigned-tray')).toHaveTextContent('Unassigned (3)')
    expect(screen.getByTestId('participant-chip-0')).toHaveTextContent('Ada')
    expect(screen.getByTestId('participant-chip-1')).toHaveTextContent('Grace')
    expect(screen.getByTestId('participant-chip-2')).toHaveTextContent('Linus')
  })

  it('renders one drop zone per unit with occupancy counts', () => {
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
    }
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={assignment}
        onAssign={vi.fn()}
      />,
    )
    expect(screen.getByTestId('room-unit-double::0')).toHaveTextContent('1/2')
    expect(screen.getByTestId('room-unit-double::1')).toHaveTextContent('0/2')
  })

  it('tap-to-place: selecting a chip then a target unit calls onAssign', () => {
    const onAssign = vi.fn()
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={{}}
        onAssign={onAssign}
      />,
    )
    // Tap the chip to select it.
    fireEvent.click(screen.getByTestId('participant-chip-1'))
    // "Place here" affordance appears on the units; click the first one.
    fireEvent.click(screen.getByTestId('assign-here-double::0'))
    expect(onAssign).toHaveBeenCalledWith(1, UNITS[0])
  })

  it('per-chip dropdown assigns a participant to a chosen unit', () => {
    const onAssign = vi.fn()
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={{}}
        onAssign={onAssign}
      />,
    )
    fireEvent.change(screen.getByTestId('tray-select-2'), {
      target: { value: 'double::1' },
    })
    expect(onAssign).toHaveBeenCalledWith(2, UNITS[1])
  })

  it('details dropdown can unassign (value "") an assigned participant', () => {
    const onAssign = vi.fn()
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
    }
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={assignment}
        onAssign={onAssign}
      />,
    )
    fireEvent.change(screen.getByTestId('assign-select-0'), {
      target: { value: '' },
    })
    expect(onAssign).toHaveBeenCalledWith(0, null)
  })

  it('tapping an assigned chip removes it (unassign)', () => {
    const onAssign = vi.fn()
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
    }
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={assignment}
        onAssign={onAssign}
      />,
    )
    // The chip inside the unit drop zone — tap removes from that unit.
    const unit = screen.getByTestId('room-unit-double::0')
    fireEvent.click(within(unit).getByText('Ada'))
    expect(onAssign).toHaveBeenCalledWith(0, null)
  })

  it('gives each chip a distinct accent colour (landr-rc4l)', () => {
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={NAMES}
        assignment={{}}
        onAssign={vi.fn()}
      />,
    )
    const hues = [0, 1, 2].map((i) =>
      screen.getByTestId(`participant-chip-${i}`).getAttribute('data-hue'),
    )
    // Every chip carries a hue and no two adjacent chips share one — so the
    // tray is "a bit colourful" rather than a wall of identical pills.
    expect(hues.every((h) => h !== null && h !== '')).toBe(true)
    expect(new Set(hues).size).toBe(hues.length)
    // The colour is applied as an inline background tint, not just an attr.
    expect(screen.getByTestId('participant-chip-0').style.backgroundColor).not.toBe('')
  })

  it('falls back to "Guest N" labels when a name is blank', () => {
    render(
      <RoomAssignment
        units={UNITS}
        participantNames={['', '']}
        assignment={{}}
        onAssign={vi.fn()}
      />,
    )
    expect(screen.getByTestId('participant-chip-0')).toHaveTextContent('Guest 1')
    expect(screen.getByTestId('participant-chip-1')).toHaveTextContent('Guest 2')
  })
})

describe('RoomAssignment — adult/child age controls (landr-doam.1)', () => {
  const SINGLE_UNIT: RoomUnit[] = [
    { roomProductId: 'single', unitIndex: 0, capacity: 2, roomName: 'Single Room' },
  ]
  const ASSIGNED: RoomAssignmentMap = {
    0: { roomProductId: 'single', unitIndex: 0 },
    1: { roomProductId: 'single', unitIndex: 0 },
  }

  it('renders an Adult/Child selector for each assigned occupant', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        ageMap={{}}
        onAgeBandChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('age-band-select-0')).toHaveValue('adult')
    expect(screen.getByTestId('age-band-select-1')).toHaveValue('adult')
    // No child-age inputs shown by default (all adult).
    expect(screen.queryByTestId('child-age-input-0')).toBeNull()
  })

  it('shows a child-age input when band is child', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        ageMap={{ 0: { band: 'child', age: null } }}
        onAgeBandChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('age-band-select-0')).toHaveValue('child')
    expect(screen.getByTestId('child-age-input-0')).toBeInTheDocument()
    // Member 1 is still adult — no age input for them.
    expect(screen.queryByTestId('child-age-input-1')).toBeNull()
  })

  it('calls onAgeBandChange when the band select changes', () => {
    const onAgeBandChange = vi.fn()
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        ageMap={{}}
        onAgeBandChange={onAgeBandChange}
      />,
    )
    fireEvent.change(screen.getByTestId('age-band-select-0'), {
      target: { value: 'child' },
    })
    expect(onAgeBandChange).toHaveBeenCalledWith(0, 'child', null)
  })

  it('does not show age controls for unassigned occupants', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace', 'Linus']}
        assignment={ASSIGNED} // Linus (2) is unassigned
        onAssign={vi.fn()}
        ageMap={{}}
        onAgeBandChange={vi.fn()}
      />,
    )
    // Linus is in the unassigned tray — no age-band select for them.
    expect(screen.queryByTestId('age-band-select-2')).toBeNull()
  })
})

describe('RoomAssignment — per-occupant breakfast toggle (landr-a4fy)', () => {
  const SINGLE_UNIT: RoomUnit[] = [
    { roomProductId: 'single', unitIndex: 0, capacity: 2, roomName: 'Single Room' },
  ]
  const ASSIGNED: RoomAssignmentMap = {
    0: { roomProductId: 'single', unitIndex: 0 },
    1: { roomProductId: 'single', unitIndex: 0 },
  }

  it('renders a breakfast toggle for each assigned occupant when breakfastRoomIds covers the room', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        breakfastMap={{ 0: true, 1: false }}
        onBreakfastChange={vi.fn()}
        breakfastRoomIds={new Set(['single'])}
      />,
    )
    // Both assigned occupants have a breakfast toggle.
    expect(screen.getByTestId('breakfast-toggle-0')).toBeInTheDocument()
    expect(screen.getByTestId('breakfast-toggle-1')).toBeInTheDocument()
  })

  it('shows breakfast badge text matching the map', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        breakfastMap={{ 0: true, 1: false }}
        onBreakfastChange={vi.fn()}
        breakfastRoomIds={new Set(['single'])}
      />,
    )
    const toggle0 = screen.getByTestId('breakfast-toggle-0')
    expect(toggle0).toHaveTextContent('breakfast')
    const toggle1 = screen.getByTestId('breakfast-toggle-1')
    expect(toggle1).toHaveTextContent('no breakfast')
  })

  it('calls onBreakfastChange when the toggle changes', () => {
    const onBreakfastChange = vi.fn()
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        breakfastMap={{ 0: false, 1: false }}
        onBreakfastChange={onBreakfastChange}
        breakfastRoomIds={new Set(['single'])}
      />,
    )
    const toggle0 = screen.getByTestId('breakfast-toggle-0')
    const checkbox = toggle0.querySelector('input[type="checkbox"]')!
    fireEvent.click(checkbox)
    expect(onBreakfastChange).toHaveBeenCalledWith(0, true)
  })

  it('does not show breakfast toggles when breakfastRoomIds is not provided', () => {
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={ASSIGNED}
        onAssign={vi.fn()}
        breakfastMap={{ 0: true, 1: true }}
        onBreakfastChange={vi.fn()}
        // breakfastRoomIds not passed → no toggles
      />,
    )
    expect(screen.queryByTestId('breakfast-toggle-0')).toBeNull()
    expect(screen.queryByTestId('breakfast-toggle-1')).toBeNull()
  })

  it('does not show breakfast toggles for unassigned occupants', () => {
    const UNASSIGNED: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 },
      // 1 is unassigned
    }
    render(
      <RoomAssignment
        units={SINGLE_UNIT}
        participantNames={['Ada', 'Grace']}
        assignment={UNASSIGNED}
        onAssign={vi.fn()}
        breakfastMap={{ 0: true, 1: true }}
        onBreakfastChange={vi.fn()}
        breakfastRoomIds={new Set(['single'])}
      />,
    )
    // Ada has a toggle (assigned).
    expect(screen.getByTestId('breakfast-toggle-0')).toBeInTheDocument()
    // Grace (unassigned) has no toggle.
    expect(screen.queryByTestId('breakfast-toggle-1')).toBeNull()
  })
})
