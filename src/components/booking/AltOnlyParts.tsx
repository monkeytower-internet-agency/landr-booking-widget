import { formatDayLabel } from '@/components/booking/dateLabel'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'

export function AltOnlyLegend() {
  const locale = browserLocale()
  return (
    <p
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      data-testid="alt-only-legend"
    >
      <span aria-hidden="true" className="text-primary">
        •
      </span>
      {tr('altDayLegend', locale)}
    </p>
  )
}

/** The line shown instead of time slots when an alt-only day is picked. */
export function AltOnlyNotice({
  productName,
  iso,
  offered,
  short = false,
}: {
  productName: string
  iso: string
  /** The product had a (full) slot that day; false → it is not offered then. */
  offered: boolean
  /** Seats are left but fewer than the group needs. */
  short?: boolean
}) {
  const locale = browserLocale()
  const text = tr(
    short ? 'altDayShortNotice' : offered ? 'altDayFullNotice' : 'altDayNotOfferedNotice',
    locale,
  )
    .replace('{product}', productName)
    .replace('{date}', formatDayLabel(iso, locale))
  return (
    <p className="text-sm font-medium" data-testid="alt-only-notice">
      {text}
    </p>
  )
}
