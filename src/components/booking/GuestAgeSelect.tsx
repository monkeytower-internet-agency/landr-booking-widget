/**
 * landr-ex4vy: the one age control of a guest: a native select whose first
 * options are the adult band(s) ("Adult" by default), then "Child, 0 years" to
 * "Child, 17 years". Every choice is complete, so there is no error state.
 */
import { tr } from '@/lib/strings'

export type GuestAgeValue = { kind: 'adult'; key: string } | { kind: 'child'; age: number }

export interface AdultOption {
  key: string
  label: string
}

interface Props {
  adults: readonly AdultOption[]
  value: GuestAgeValue
  onChange: (next: GuestAgeValue) => void
  /** Adult options only (the booker). */
  adultOnly?: boolean
  locale: string
  testId: string
}

const SELECT = 'border-input bg-surface-page h-9 rounded-md border px-2 text-sm'

const childYearsLabel = (age: number, locale: string): string =>
  tr(age === 1 ? 'childYearOption' : 'childYearsOption', locale).replace('{n}', String(age))

export function GuestAgeSelect({ adults, value, onChange, adultOnly = false, locale, testId }: Props) {
  const current = value.kind === 'child' ? `c:${value.age}` : `a:${value.key}`
  return (
    <select
      data-testid={testId}
      aria-label={tr('ageBandAria', locale)}
      value={current}
      onChange={(e) => {
        const v = e.target.value
        onChange(v.startsWith('c:') ? { kind: 'child', age: Number(v.slice(2)) } : { kind: 'adult', key: v.slice(2) })
      }}
      className={SELECT}
    >
      {adults.map((a) => (
        <option key={a.key} value={`a:${a.key}`}>
          {a.label}
        </option>
      ))}
      {adultOnly
        ? null
        : Array.from({ length: 18 }, (_, a) => (
            <option key={a} value={`c:${a}`}>
              {childYearsLabel(a, locale)}
            </option>
          ))}
    </select>
  )
}
