/**
 * landr-hfvyc.2: Adult / Child + age per guest, rendered inline on the review
 * step's added stay line when the guest step never collected ages (no stay with
 * occupancy pricing was in the cart then). The first guest stays an adult.
 *
 * landr-zcb24.2: the options are the cart's age bands. When an added line's
 * flow asks ages (`ageBands` given) the first guest (the booker) shows too:
 * adult bands only plus a required "I am 18 or older", and an adult band is
 * stored as its floor.
 */
import type { FlowAgeBand } from '@/api/flowTypes'
import { tr } from '@/lib/strings'
import { ADULT_FROM, adultBandsOf, bandLabel, DEFAULT_AGE_BANDS, isAdultBand, orderedBands } from './ageBands'
import { ExactAgeControl } from './AgeBandControls'
import type { GuestAgeEntry } from './crossSell'

interface Props {
  /** One label per roster member; index 0 is the always-adult first guest. */
  labels: readonly string[]
  value: Readonly<Record<number, GuestAgeEntry>>
  onChange: (next: Record<number, GuestAgeEntry>) => void
  locale: string
  /** The flow asks ages: the bands to offer, floors are stored, the booker confirms 18+. */
  ageBands?: readonly FlowAgeBand[]
  /** landr-zcb24.7: the operator collects age as exact: a number per guest, the booker 18+. */
  exact?: boolean
}

const SELECT = 'border-input bg-surface-page h-9 rounded-md border px-2 text-sm'

export function InlineGuestAges({ labels, value, onChange, locale, ageBands, exact = false }: Props) {
  const storeFloor = ageBands !== undefined
  const bands = ageBands ?? DEFAULT_AGE_BANDS
  const adults = adultBandsOf(bands)
  const set = (i: number, entry: GuestAgeEntry) => onChange({ ...value, [i]: entry })
  return (
    <ul className="space-y-2" data-testid="inline-guest-ages">
      {labels.map((label, i) => {
        if (exact) {
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-24">{label}</span>
              <ExactAgeControl
                id={`inline-${i}`}
                booker={i === 0}
                age={value[i]?.age ?? null}
                locale={locale}
                onChange={(age) =>
                  set(i, {
                    band: age !== null && age < ADULT_FROM ? 'child' : 'adult',
                    age,
                    ...(i === 0 ? { confirmed: age !== null && age >= ADULT_FROM } : {}),
                  })
                }
              />
            </li>
          )
        }
        if (i === 0 && !storeFloor) return null
        const entry: GuestAgeEntry = value[i] ?? { band: 'adult', age: null }
        const adultKey = (floor: number | undefined) =>
          (adults.find((b) => b.min_age === floor) ?? adults[0]).key
        const selectedKey = entry.band === 'child' ? 'child' : adultKey(entry.floor)
        const pick = (key: string) => {
          const band = bands.find((b) => b.key === key)
          if (band && !isAdultBand(band)) {
            set(i, { ...entry, band: 'child', age: entry.band === 'child' ? entry.age : null, floor: undefined })
          } else {
            set(i, { ...entry, band: 'adult', age: null, floor: storeFloor ? (band ?? adults[0]).min_age : undefined })
          }
        }
        return (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-24">{label}</span>
            {i > 0 || adults.length > 1 ? (
              <select
                data-testid={`inline-age-band-${i}`}
                aria-label={tr('ageBandAria', locale)}
                value={selectedKey}
                onChange={(e) => pick(e.target.value)}
                className={SELECT}
              >
                {(i === 0 ? adults : orderedBands(bands)).map((b) => (
                  <option key={b.key} value={b.key}>
                    {bandLabel(b, bands, locale)}
                  </option>
                ))}
              </select>
            ) : null}
            {i === 0 ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="inline-booker-adult-confirm"
                  checked={entry.confirmed === true}
                  onChange={(e) =>
                    set(0, {
                      ...entry,
                      band: 'adult',
                      age: null,
                      floor: (adults.find((b) => b.min_age === entry.floor) ?? adults[0]).min_age,
                      confirmed: e.target.checked,
                    })
                  }
                  className="h-3.5 w-3.5 accent-primary"
                />
                {tr('bookerAdultConfirm', locale)}
              </label>
            ) : null}
            {i > 0 && entry.band === 'child' ? (
              <select
                data-testid={`inline-age-${i}`}
                aria-label={tr('childAgeAria', locale)}
                value={entry.age ?? ''}
                aria-invalid={entry.age == null ? true : undefined}
                onChange={(e) =>
                  set(i, { band: 'child', age: e.target.value === '' ? null : Number(e.target.value) })
                }
                className={SELECT}
              >
                <option value="">{tr('agePlaceholder', locale)}</option>
                {Array.from({ length: 18 }, (_, a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            ) : null}
            {i > 0 && entry.band === 'child' && entry.age == null ? (
              <span className="text-xs text-destructive" role="alert">
                {tr('guestAgeRequired', locale)}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
