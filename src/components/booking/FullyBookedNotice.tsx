import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'

/**
 * landr-7jgo: informational "Fully booked" state for a product that has no
 * upcoming bookable dates (bookable === false). Deliberately carries NO date
 * picker and NO "Select" CTA — there is nothing to book.
 *
 * Two render contexts share this component:
 *   1. Inline card inside the catalogue overview (compact), shown only when
 *      an embed opts into `show_sold_out=true`. No back button there.
 *   2. Standalone page for a single-product deep link (?product=<slug>) that
 *      resolved to a sold-out product — the product is ALWAYS rendered, just
 *      as "Fully booked". A back button is shown when onBack is provided.
 */
interface Props {
  name: string
  /** Optional short description, rendered under the title when present. */
  description?: string | null
  /** When provided, renders a back affordance (deep-link standalone page). */
  onBack?: () => void
  /** Compact variant for the catalogue grid (no min-height, tighter copy). */
  compact?: boolean
}

const FULLY_BOOKED_LABEL = 'Fully booked'
const FULLY_BOOKED_BLURB =
  'There are no upcoming dates available for this product right now. Please check back later.'

export function FullyBookedNotice({ name, description, onBack, compact }: Props) {
  return (
    <Card className={compact ? 'flex flex-col opacity-75' : 'flex flex-col'}>
      {onBack ? <StepBackButton onBack={onBack} /> : null}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{name}</CardTitle>
          <span
            className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            data-testid="fully-booked-badge"
          >
            {FULLY_BOOKED_LABEL}
          </span>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {FULLY_BOOKED_BLURB}
      </CardContent>
    </Card>
  )
}
