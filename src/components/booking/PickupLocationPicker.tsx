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
import { Label } from '@/components/ui/label'

interface Props {
  operatorSlug: string
  productName: string
  onBack: () => void
  onConfirm: (locationId: string) => void
}

export function PickupLocationPicker({ operatorSlug, productName, onBack, onConfirm }: Props) {
  const [locations, setLocations] = useState<Location[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
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
    return () => { cancelled = true }
  }, [operatorSlug])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup location</CardTitle>
        <CardDescription>{productName} · Choose where we pick you up</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading pickup locations…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pickup locations configured — contact operator
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Pickup location</legend>
            {locations.map((loc) => (
              <label
                key={loc.location_id}
                className={[
                  'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                  selected === loc.location_id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="pickup_location"
                  value={loc.location_id}
                  checked={selected === loc.location_id}
                  onChange={() => setSelected(loc.location_id)}
                  className="h-4 w-4 accent-primary"
                />
                <Label className="cursor-pointer text-sm font-normal">{loc.name}</Label>
              </label>
            ))}
          </fieldset>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={!selected || loading}
            onClick={() => { if (selected) onConfirm(selected) }}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
