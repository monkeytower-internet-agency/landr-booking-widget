import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { FlowAgeBand } from '@/api/flowTypes'
import type { GuestAgeEntry } from './crossSell'
import { InlineGuestAges } from './InlineGuestAges'

const BANDS: FlowAgeBand[] = [
  { key: 'child', min_age: 0, max_age: 17 },
  { key: 'adult', min_age: 18, max_age: 64, label_localized: { en: 'Adult 18-64' } },
  { key: 'age_65_plus', min_age: 65, max_age: null, label_localized: { en: 'Senior 65+' } },
]

function Harness({ onChange, ageBands }: { onChange: (v: Record<number, GuestAgeEntry>) => void; ageBands?: FlowAgeBand[] }) {
  const [value, setValue] = useState<Record<number, GuestAgeEntry>>({})
  return (
    <InlineGuestAges
      labels={['Ada', 'Tim']}
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
      locale="en"
      ageBands={ageBands}
    />
  )
}

describe('InlineGuestAges bands (landr-zcb24.2)', () => {
  it('without bands it is the old Adult / Child pair and skips the first guest', () => {
    render(<Harness onChange={vi.fn()} />)
    expect(screen.queryByTestId('inline-age-band-0')).not.toBeInTheDocument()
    expect(Array.from(screen.getByTestId('inline-age-band-1').querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'Adult',
      'Child',
    ])
  })

  it('with the flow bands: floors for adults, booker adult-only with 18+ confirmation', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} ageBands={BANDS} />)
    expect(Array.from(screen.getByTestId('inline-age-band-0').querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'Adult 18-64',
      'Senior 65+',
    ])
    fireEvent.change(screen.getByTestId('inline-age-band-1'), { target: { value: 'age_65_plus' } })
    expect(onChange).toHaveBeenLastCalledWith({ 1: { band: 'adult', age: null, floor: 65 } })
    fireEvent.click(screen.getByTestId('inline-booker-adult-confirm'))
    expect(onChange).toHaveBeenLastCalledWith({
      1: { band: 'adult', age: null, floor: 65 },
      0: { band: 'adult', age: null, floor: 18, confirmed: true },
    })
  })
})

describe('InlineGuestAges exact (landr-zcb24.7)', () => {
  it('asks a number per guest, the booker confirmed at 18+', () => {
    const onChange = vi.fn()
    function ExactHarness() {
      const [value, setValue] = useState<Record<number, GuestAgeEntry>>({})
      return (
        <InlineGuestAges
          labels={['Ada', 'Tim']}
          value={value}
          onChange={(v) => {
            setValue(v)
            onChange(v)
          }}
          locale="en"
          exact
        />
      )
    }
    render(<ExactHarness />)
    fireEvent.change(screen.getByTestId('guest-age-inline-0'), { target: { value: '40' } })
    fireEvent.change(screen.getByTestId('guest-age-inline-1'), { target: { value: '9' } })
    expect(onChange).toHaveBeenLastCalledWith({
      0: { band: 'adult', age: 40, confirmed: true },
      1: { band: 'child', age: 9 },
    })
  })
})

describe('InlineGuestAges re-ask (landr-zcb24.12)', () => {
  function RefineHarness({ onChange }: { onChange: (v: Record<number, GuestAgeEntry>) => void }) {
    const [value, setValue] = useState<Record<number, GuestAgeEntry>>({})
    return (
      <InlineGuestAges
        labels={['Ada', 'Tim', 'Kid']}
        value={value}
        onChange={(v) => {
          setValue(v)
          onChange(v)
        }}
        locale="en"
        ageBands={BANDS}
        only={[0, 1]}
      />
    )
  }

  it('shows only the re-asked guests, adult bands only, with a prompt and no 18+ confirmation', () => {
    render(<RefineHarness onChange={vi.fn()} />)
    expect(screen.getByTestId('inline-age-band-0')).toBeInTheDocument()
    expect(screen.getByTestId('inline-age-band-1')).toBeInTheDocument()
    expect(screen.queryByTestId('inline-age-band-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inline-booker-adult-confirm')).not.toBeInTheDocument()
    expect(Array.from(screen.getByTestId('inline-age-band-1').querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'Choose age group',
      'Adult 18-64',
      'Senior 65+',
    ])
  })

  it('stores the picked adult floor', () => {
    const onChange = vi.fn()
    render(<RefineHarness onChange={onChange} />)
    fireEvent.change(screen.getByTestId('inline-age-band-1'), { target: { value: 'age_65_plus' } })
    expect(onChange).toHaveBeenLastCalledWith({ 1: { band: 'adult', age: null, floor: 65 } })
    expect(
      Array.from(screen.getByTestId('inline-age-band-1').querySelectorAll('option')).map((o) => o.textContent),
    ).toEqual(['Adult 18-64', 'Senior 65+'])
  })
})
