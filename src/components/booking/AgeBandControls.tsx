/**
 * landr-zcb24.2: the age control of one guest in the party step: one select
 * built from the flow's age bands: the adult band(s) first ("Adult", "Senior 65+"),
 * then "Child, 0 years" to "Child, 17 years" (landr-ex4vy).
 */
import type { FlowAgeBand } from '@/api/flowTypes'
import { tr } from '@/lib/strings'
import { adultBandsOf, bandLabel, childKey, ADULT_FROM, type AgeChoice } from './ageBands'
import { GuestAgeSelect, type GuestAgeValue } from './GuestAgeSelect'

interface Props {
  bands: readonly FlowAgeBand[]
  choice: AgeChoice
  onChange: (bandKey: string, childAge: number | null) => void
  locale: string
  /** Suffix of the test ids: `guest-age-controls-<id>`, `guest-age-<id>`. */
  id: string
  /** The booker: adult options only, and no select at all when there is just one. */
  adultOnly?: boolean
}

export function AgeBandControls({ bands, choice, onChange, locale, id, adultOnly = false }: Props) {
  const adultBands = adultBandsOf(bands)
  if (adultOnly && adultBands.length <= 1) return null
  const adults = adultBands.map((b) => ({ key: b.key, label: bandLabel(b, bands, locale) }))
  const selected = bands.find((b) => b.key === choice.bandKey)
  const value: GuestAgeValue =
    selected && selected.min_age < ADULT_FROM && choice.age !== null
      ? { kind: 'child', age: choice.age }
      : { kind: 'adult', key: selected && selected.min_age >= ADULT_FROM ? selected.key : adults[0].key }
  return (
    <div className="sm:col-span-2 flex flex-wrap items-center gap-2" data-testid={`guest-age-controls-${id}`}>
      <GuestAgeSelect
        testId={`guest-age-band-${id}`}
        adults={adults}
        value={value}
        adultOnly={adultOnly}
        locale={locale}
        onChange={(v) => (v.kind === 'child' ? onChange(childKey(bands), v.age) : onChange(v.key, null))}
      />
    </div>
  )
}

interface ExactProps {
  /** The exact age of a child; null for an adult. */
  age: number | null
  onChange: (age: number | null) => void
  locale: string
  /** Suffix of the test ids: `guest-age-controls-<id>`, `guest-age-<id>`. */
  id: string
  /** The booker: an adult, so there is nothing to choose and nothing shows. */
  booker?: boolean
}

/**
 * landr-ex4vy: the age control when the operator collects age as exact: the same
 * one select, "Adult" (no age) or "Child, N years".
 */
export function ExactAgeControl({ age, onChange, locale, id, booker = false }: ExactProps) {
  if (booker) return null
  const value: GuestAgeValue =
    age !== null && age < ADULT_FROM ? { kind: 'child', age } : { kind: 'adult', key: 'adult' }
  return (
    <div className="sm:col-span-2 flex flex-wrap items-center gap-2" data-testid={`guest-age-controls-${id}`}>
      <GuestAgeSelect
        testId={`guest-age-band-${id}`}
        adults={[{ key: 'adult', label: tr('adultOption', locale) }]}
        value={value}
        locale={locale}
        onChange={(v) => onChange(v.kind === 'child' ? v.age : null)}
      />
    </div>
  )
}
