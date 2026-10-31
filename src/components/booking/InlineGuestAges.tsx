/**
 * landr-hfvyc.2: Adult / Child + age per guest, rendered inline on the review
 * step's added stay line when the guest step never collected ages (no stay with
 * occupancy pricing was in the cart then). The first guest stays an adult.
 */
import { tr } from '@/lib/strings'
import type { GuestAgeEntry } from './crossSell'

interface Props {
  /** One label per roster member; index 0 is the always-adult first guest. */
  labels: readonly string[]
  value: Readonly<Record<number, GuestAgeEntry>>
  onChange: (next: Record<number, GuestAgeEntry>) => void
  locale: string
}

export function InlineGuestAges({ labels, value, onChange, locale }: Props) {
  const set = (i: number, entry: GuestAgeEntry) => onChange({ ...value, [i]: entry })
  return (
    <ul className="space-y-2" data-testid="inline-guest-ages">
      {labels.map((label, i) => {
        if (i === 0) return null
        const entry = value[i] ?? { band: 'adult', age: null }
        return (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-24">{label}</span>
            <select
              data-testid={`inline-age-band-${i}`}
              aria-label={tr('ageBandAria', locale)}
              value={entry.band}
              onChange={(e) =>
                set(i, {
                  band: e.target.value === 'child' ? 'child' : 'adult',
                  age: e.target.value === 'child' ? entry.age : null,
                })
              }
              className="border-input bg-surface-page h-9 rounded-md border px-2 text-sm"
            >
              <option value="adult">{tr('adultOption', locale)}</option>
              <option value="child">{tr('childOption', locale)}</option>
            </select>
            {entry.band === 'child' ? (
              <select
                data-testid={`inline-age-${i}`}
                aria-label={tr('childAgeAria', locale)}
                value={entry.age ?? ''}
                aria-invalid={entry.age == null ? true : undefined}
                onChange={(e) =>
                  set(i, { band: 'child', age: e.target.value === '' ? null : Number(e.target.value) })
                }
                className="border-input bg-surface-page h-9 rounded-md border px-2 text-sm"
              >
                <option value="">{tr('agePlaceholder', locale)}</option>
                {Array.from({ length: 18 }, (_, a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            ) : null}
            {entry.band === 'child' && entry.age == null ? (
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
