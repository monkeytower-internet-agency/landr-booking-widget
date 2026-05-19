import { useEffect, useState } from 'react'
import { listLocations } from '@/api/client'
import type { Location } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'

interface Props {
  operatorSlug: string
  productName: string
  onBack: () => void
  onConfirm: (locationId: string) => void
}

/**
 * Pickup location picker.
 *
 * landr-ulc2 fix: the previous version used a Radix `<Label>` *inside*
 * an HTML `<label>` and keyed/checked on `loc.location_id`. When the
 * public locations RPC was returning `id` (now renamed to
 * `location_id` per landr-vyaz), every row read undefined for its key
 * — React collapsed mounts onto a single key, the last row's input
 * won the rendered state, and the Continue button never enabled
 * because `selected === undefined` failed. The fix has two parts:
 *
 *   1. The API-side rename to `location_id` aligns the wire with the
 *      widget's Location TS type — see the companion landr-api PR.
 *   2. Drop the nested `<Label>` inside `<label>` (invalid HTML,
 *      contributed to the duplicate-onChange-fires-for-last-row
 *      symptom) and use a span instead. Per-row handlers stay scoped
 *      to `loc.location_id` so there's no shared-closure surface.
 */
export function PickupLocationPicker({
  operatorSlug,
  productName,
  onBack,
  onConfirm,
}: Props) {
  const [locations, setLocations] = useState<Location[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const locale = browserLocale()

  useEffect(() => {
    let cancelled = false
    listLocations(operatorSlug)
      .then((locs) => {
        if (!cancelled) setLocations(locs)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [operatorSlug])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup location</CardTitle>
        <CardDescription>
          {productName} · Choose where we pick you up
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading pickup locations…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pickup locations configured — contact operator
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Pickup location</legend>
            {locations.map((loc) => {
              const name = pickLocalized(loc.name, loc.name_localized, locale)
              const isSelected = selected === loc.location_id
              return (
                <label
                  key={loc.location_id}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="pickup_location"
                    value={loc.location_id}
                    checked={isSelected}
                    onChange={() => setSelected(loc.location_id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{name}</span>
                </label>
              )
            })}
          </fieldset>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={!selected || loading}
            onClick={() => {
              if (selected) onConfirm(selected)
            }}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
