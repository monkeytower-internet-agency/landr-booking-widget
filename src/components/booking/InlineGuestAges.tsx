/**
 * landr-hfvyc.2: one age select per guest (Adult or Child, N years), rendered inline on the review
 * step's added stay line when the guest step never collected ages (no stay with
 * occupancy pricing was in the cart then). The first guest stays an adult.
 *
 * landr-zcb24.2: the options are the cart's age bands. When an added line's
 * flow asks ages (`ageBands` given) the first guest (the booker) shows too:
 * adult bands only (assumed an adult), and an adult band is
 * stored as its floor.
 *
 * landr-zcb24.12: with `only` the party step already asked the ages and an added
 * line split some bands: just those guests pick their adult band again (from the
 * refined `ageBands`), nobody else shows.
 */
import type { FlowAgeBand } from '@/api/flowTypes'
import { tr } from '@/lib/strings'
import { ADULT_FROM, adultBandsOf, bandLabel, DEFAULT_AGE_BANDS } from './ageBands'
import { GuestAgeSelect } from './GuestAgeSelect'
import type { GuestAgeEntry } from './crossSell'

interface Props {
  /** One label per roster member; index 0 is the always-adult first guest. */
  labels: readonly string[]
  value: Readonly<Record<number, GuestAgeEntry>>
  onChange: (next: Record<number, GuestAgeEntry>) => void
  locale: string
  /** The flow asks ages: the bands to offer, floors are stored, the booker is assumed an adult. */
  ageBands?: readonly FlowAgeBand[]
  /** landr-zcb24.7: the operator collects age as exact: a number per guest, the booker 18+. */
  exact?: boolean
  /** landr-zcb24.12: only these roster guests pick an adult band again. */
  only?: readonly number[]
}

const SELECT = 'border-input bg-surface-page h-9 rounded-md border px-2 text-sm'

export function InlineGuestAges({ labels, value, onChange, locale, ageBands, exact = false, only }: Props) {
  const storeFloor = ageBands !== undefined
  const bands = ageBands ?? DEFAULT_AGE_BANDS
  const adults = adultBandsOf(bands)
  const set = (i: number, entry: GuestAgeEntry) => onChange({ ...value, [i]: entry })
  if (only !== undefined) {
    return (
      <div className="space-y-2" data-testid="inline-guest-ages-refine">
        <p className="text-sm text-muted-foreground">{tr('ageRefineIntro', locale)}</p>
        <ul className="space-y-2" data-testid="inline-guest-ages">
          {labels.map((label, i) => {
            if (!only.includes(i)) return null
            const picked = adults.find((b) => b.min_age === value[i]?.floor)
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-24">{label}</span>
                <select
                  data-testid={`inline-age-band-${i}`}
                  aria-label={tr('ageBandAria', locale)}
                  aria-invalid={picked ? undefined : true}
                  value={picked?.key ?? ''}
                  onChange={(e) => {
                    const band = adults.find((b) => b.key === e.target.value)
                    if (band) set(i, { band: 'adult', age: null, floor: band.min_age })
                  }}
                  className={SELECT}
                >
                  {picked ? null : <option value="">{tr('ageRefineChoose', locale)}</option>}
                  {adults.map((b) => (
                    <option key={b.key} value={b.key}>
                      {bandLabel(b, bands, locale)}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
  const adultOptions = adults.map((b) => ({ key: b.key, label: bandLabel(b, bands, locale) }))
  return (
    <ul className="space-y-2" data-testid="inline-guest-ages">
      {labels.map((label, i) => {
        if (exact) {
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-24">{label}</span>
              {i === 0 ? null : (
                <GuestAgeSelect
                  testId={`inline-age-band-${i}`}
                  adults={[{ key: 'adult', label: tr('adultOption', locale) }]}
                  locale={locale}
                  value={
                    value[i]?.age != null && value[i].age! < ADULT_FROM
                      ? { kind: 'child', age: value[i].age! }
                      : { kind: 'adult', key: 'adult' }
                  }
                  onChange={(v) =>
                    set(i, v.kind === 'child' ? { band: 'child', age: v.age } : { band: 'adult', age: null })
                  }
                />
              )}
            </li>
          )
        }
        if (i === 0 && !storeFloor) return null
        // The booker stays an adult: nothing to pick unless several adult bands.
        if (i === 0 && adults.length <= 1) {
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-24">{label}</span>
            </li>
          )
        }
        const entry: GuestAgeEntry = value[i] ?? { band: 'adult', age: null }
        const adultKey = (floor: number | undefined) =>
          (adults.find((b) => b.min_age === floor) ?? adults[0]).key
        return (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-24">{label}</span>
            <GuestAgeSelect
              testId={`inline-age-band-${i}`}
              adults={adultOptions}
              adultOnly={i === 0}
              locale={locale}
              value={
                entry.band === 'child' && entry.age != null
                  ? { kind: 'child', age: entry.age }
                  : { kind: 'adult', key: adultKey(entry.floor) }
              }
              onChange={(v) => {
                if (v.kind === 'child') set(i, { band: 'child', age: v.age })
                else {
                  const band = adults.find((b) => b.key === v.key) ?? adults[0]
                  set(i, { band: 'adult', age: null, floor: storeFloor ? band.min_age : undefined })
                }
              }}
            />
          </li>
        )
      })}
    </ul>
  )
}
