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

describe('RoomAssignment — breakfast as draggable chips (landr-z59y)', () => {
  // A double room (capacity 2) holding 2 people — the user's key example: it
  // can't be split, so breakfast is a chip dragged onto one of the two people.
  const DOUBLE: RoomUnit[] = [
    { roomProductId: 'double', unitIndex: 0, capacity: 2, roomName: 'Double Room' },
  ]
  const BOTH_IN_DOUBLE: RoomAssignmentMap = {
    0: { roomProductId: 'double', unitIndex: 0 },
    1: { roomProductId: 'double', unitIndex: 0 },
  }

  it('partial: double room + 1 breakfast + 2 people renders exactly ONE breakfast chip on the default holder', () => {
    render(
      <RoomAssignment
        units={DOUBLE}
        participantNames={['Ada', 'Grace']}
        assignment={BOTH_IN_DOUBLE}
        onAssign={vi.fn()}
        perRoomAddons={{ double: { 'bf-1': 1 } }}
        // Default placement: occupant 0 (Ada, lowest index) holds the chip.
        breakfastMap={{ 0: true }}
        onBreakfastAssign={vi.fn()}
      />,
    )
    // The room title shows the breakfast count.
    expect(screen.getByTestId('room-unit-title-double::0')).toHaveTextContent(
      '(1 breakfast)',
    )
    // Exactly one breakfast chip, on Ada (occupant 0).
    expect(screen.getByTestId('breakfast-chip-0')).toBeInTheDocument()
    expect(screen.queryByTestId('breakfast-chip-1')).toBeNull()
    // Grace (no chip) gets a "+ breakfast" tap-to-place affordance.
    expect(screen.getByTestId('give-breakfast-1')).toBeInTheDocument()
    // Ada (holds the chip) does not.
    expect(screen.queryByTestId('give-breakfast-0')).toBeNull()
  })

  it('partial: the "+ breakfast" tap on the other occupant fires onBreakfastAssign (chip reassignment path)', () => {
    const onBreakfastAssign = vi.fn()
    render(
      <RoomAssignment
        units={DOUBLE}
        participantNames={['Ada', 'Grace']}
        assignment={BOTH_IN_DOUBLE}
        onAssign={vi.fn()}
        perRoomAddons={{ double: { 'bf-1': 1 } }}
        breakfastMap={{ 0: true }}
        onBreakfastAssign={onBreakfastAssign}
      />,
    )
    fireEvent.click(screen.getByTestId('give-breakfast-1'))
    // Reassign the (single) breakfast chip to Grace (occupant 1).
    expect(onBreakfastAssign).toHaveBeenCalledWith(1)
  })

  it('all: double room + 2 breakfasts + 2 people shows "(2 breakfasts)", static chips, no reassignment UI', () => {
    render(
      <RoomAssignment
        units={DOUBLE}
        participantNames={['Ada', 'Grace']}
        assignment={BOTH_IN_DOUBLE}
        onAssign={vi.fn()}
        perRoomAddons={{ double: { 'bf-1': 2 } }}
        breakfastMap={{ 0: true, 1: true }}
        onBreakfastAssign={vi.fn()}
      />,
    )
    expect(screen.getByTestId('room-unit-title-double::0')).toHaveTextContent(
      '(2 breakfasts)',
    )
    // Both occupants show a (static) breakfast chip.
    const chip0 = screen.getByTestId('breakfast-chip-0')
    const chip1 = screen.getByTestId('breakfast-chip-1')
    expect(chip0).toHaveAttribute('data-breakfast-static', 'true')
    expect(chip1).toHaveAttribute('data-breakfast-static', 'true')
    // No "+ breakfast" reassignment affordance — everyone already eats.
    expect(screen.queryByTestId('give-breakfast-0')).toBeNull()
    expect(screen.queryByTestId('give-breakfast-1')).toBeNull()
  })

  it('none: double room + 0 breakfast shows a plain "Double Room" with no breakfast UI', () => {
    render(
      <RoomAssignment
        units={DOUBLE}
        participantNames={['Ada', 'Grace']}
        assignment={BOTH_IN_DOUBLE}
        onAssign={vi.fn()}
        perRoomAddons={{}}
        breakfastMap={{}}
        onBreakfastAssign={vi.fn()}
      />,
    )
    const title = screen.getByTestId('room-unit-title-double::0')
    expect(title).not.toHaveTextContent('breakfast')
    expect(screen.queryByTestId('room-unit-breakfast-double::0')).toBeNull()
    expect(screen.queryByTestId('breakfast-chip-0')).toBeNull()
    expect(screen.queryByTestId('breakfast-chip-1')).toBeNull()
  })

  it('single room: 1 breakfast + 1 person reads "(with breakfast)" (all-mode, qty===occ===1)', () => {
    render(
      <RoomAssignment
        units={[
          { roomProductId: 'single', unitIndex: 0, capacity: 1, roomName: 'Single Room' },
        ]}
        participantNames={['Ada']}
        assignment={{ 0: { roomProductId: 'single', unitIndex: 0 } }}
        onAssign={vi.fn()}
        perRoomAddons={{ single: { 'bf-1': 1 } }}
        breakfastMap={{ 0: true }}
        onBreakfastAssign={vi.fn()}
      />,
    )
    expect(screen.getByTestId('room-unit-title-single::0')).toHaveTextContent(
      '(with breakfast)',
    )
  })

  it('no longer renders the per-occupant breakfast checkbox/toggle', () => {
    const { container } = render(
      <RoomAssignment
        units={DOUBLE}
        participantNames={['Ada', 'Grace']}
        assignment={BOTH_IN_DOUBLE}
        onAssign={vi.fn()}
        perRoomAddons={{ double: { 'bf-1': 1 } }}
        breakfastMap={{ 0: true }}
        onBreakfastAssign={vi.fn()}
      />,
    )
    // The old landr-a4fy toggle testids are gone.
    expect(screen.queryByTestId('breakfast-toggle-0')).toBeNull()
    expect(screen.queryByTestId('breakfast-toggle-1')).toBeNull()
    // And no breakfast checkbox input remains anywhere in the assignment UI.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  })
})
