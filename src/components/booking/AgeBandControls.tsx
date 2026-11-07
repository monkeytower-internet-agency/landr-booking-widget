/**
 * landr-zcb24.2: the age control of one guest in the party step: a band select
 * built from the flow's age bands (Child + an exact 0-17 age, or an adult band
 * such as "Senior 65+"). Child / Adult only looks exactly as it did before bands.
 */
import type { FlowAgeBand } from '@/api/flowTypes'
import { tr } from '@/lib/strings'
import { adultBandsOf, bandLabel, isAdultBand, orderedBands, type AgeChoice } from './ageBands'

interface Props {
  bands: readonly FlowAgeBand[]
  choice: AgeChoice
  onChange: (bandKey: string, childAge: number | null) => void
  locale: string
  /** Suffix of the test ids: `guest-age-controls-<id>`, `guest-age-band-<id>`, `guest-age-<id>`. */
  id: string
  /** The booker: adult bands only, and no select at all when there is just one. */
  adultOnly?: boolean
}

const SELECT = 'border-input bg-surface-page h-9 rounded-md border px-2 text-sm'

export function AgeBandControls({ bands, choice, onChange, locale, id, adultOnly = false }: Props) {
  const offered = adultOnly ? adultBandsOf(bands) : orderedBands(bands)
  const showBandSelect = !(adultOnly && offered.length <= 1)
  const selected = bands.find((b) => b.key === choice.bandKey)
  const isChild = !!selected && !isAdultBand(selected)
  if (!showBandSelect) return null
  return (
    <div className="sm:col-span-2 flex flex-wrap items-center gap-2" data-testid={`guest-age-controls-${id}`}>
      <select
        data-testid={`guest-age-band-${id}`}
        aria-label={tr('ageBandAria', locale)}
        value={choice.bandKey}
        onChange={(e) => onChange(e.target.value, isChild ? choice.age : null)}
        className={SELECT}
      >
        {offered.map((b) => (
          <option key={b.key} value={b.key}>
            {bandLabel(b, bands, locale)}
          </option>
        ))}
      </select>
      {isChild ? (
        <select
          data-testid={`guest-age-${id}`}
          aria-label={tr('childAgeAria', locale)}
          value={choice.age ?? ''}
          onChange={(e) => onChange(choice.bandKey, e.target.value === '' ? null : Number(e.target.value))}
          aria-invalid={choice.age == null ? true : undefined}
          className={`${SELECT} aria-invalid:border-destructive`}
        >
          <option value="">{tr('agePlaceholder', locale)}</option>
          {Array.from({ length: 18 }, (_, a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      ) : null}
      {isChild && choice.age == null ? (
        <span className="text-xs text-destructive" role="alert">
          {tr('guestAgeRequired', locale)}
        </span>
      ) : null}
    </div>
  )
}
