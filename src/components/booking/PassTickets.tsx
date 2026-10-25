import type { PassTicket } from '@/api/types'
import { browserLocale } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { formatDayLabel } from './dateLabel'

interface Props {
  tickets: PassTicket[]
}

/**
 * one QR ticket per guest, with the validity window, on the
 * confirmation screen. The same tickets are in the confirmation email; the QR
 * is the pass (checked in at the entrance by scanning it).
 */
export function PassTickets({ tickets }: Props) {
  const locale = browserLocale()
  if (tickets.length === 0) return null
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border bg-surface-well px-3 py-3 shadow-well"
      data-testid="pass-tickets"
    >
      <h3 className="text-sm font-semibold">{tr('passTicketsTitle', locale)}</h3>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tickets.map((t) => (
          <li
            key={t.participant_id}
            className="flex flex-col items-start gap-1"
            data-testid="pass-ticket"
          >
            <img
              src={t.png_url}
              alt={t.first_name}
              width={160}
              height={160}
              className="rounded-md border bg-white"
            />
            <span className="text-sm font-medium">{t.first_name}</span>
            {t.pass_label ? (
              <span className="text-xs text-muted-foreground">{t.pass_label}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {fmt(tr('passTicketsHelp', locale), {
                from: formatDayLabel(t.valid_from, locale),
                until: formatDayLabel(t.valid_until, locale),
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
