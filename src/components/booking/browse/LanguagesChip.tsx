/**
 * landr-pv2r1 (epic decision E4): the compact guide-languages chip shared by
 * the catalogue card and row — languages icon + flag emojis (decorative),
 * "+N" past LANGUAGE_CHIP_MAX_FLAGS, full English names in `title` +
 * `aria-label`. Styled exactly like the card/row's local meta/kind Chip so
 * the chip row reads as one set; data comes from productLanguagesChip.
 */
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { productLanguagesChip } from './productCardData'

export function LanguagesChip({
  chip,
  radius,
}: {
  chip: NonNullable<ReturnType<typeof productLanguagesChip>>
  radius: string
}) {
  const overflow = chip.codes.length - chip.flags.length
  return (
    <span
      data-testid="product-languages-chip"
      role="img"
      title={chip.label}
      aria-label={chip.label}
      className={cn(
        'inline-flex items-center gap-1 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        radius,
      )}
    >
      <Languages className="size-3 shrink-0" aria-hidden />
      <span aria-hidden>{chip.flags.join(' ')}</span>
      {overflow > 0 ? <span aria-hidden>+{overflow}</span> : null}
    </span>
  )
}
