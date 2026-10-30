import { Users } from 'lucide-react'
import { tr } from '@/lib/strings'

/** "max. N guests" chip for stay cards (and alternatives rows). */
export function MaxGuestsChip({
  max,
  locale,
  radius,
}: {
  max: number
  locale: string
  radius?: string
}) {
  return (
    <span
      data-testid="max-guests-chip"
      className={`inline-flex items-center gap-1 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ${radius ?? 'rounded-full'}`}
    >
      <Users className="size-3" aria-hidden="true" />
      {tr('maxGuestsChip', locale).replace('{n}', String(max))}
    </span>
  )
}
