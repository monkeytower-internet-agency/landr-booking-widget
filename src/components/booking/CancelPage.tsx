import { useEffect, useState } from 'react'

import {
  cancelBooking,
  getCancelPreview,
  isCancellationDeadlinePassed,
  type CancelBookingResponse,
  type CancelPreview,
  type CancelRefundStatus,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  fmtCancel,
  normalizeCancelLocale,
  pickCancelBundle,
  type CancelBundle,
  type CancelLocale,
} from './cancelStrings'

/**
 * Customer self-cancel page (landr-sgnd, token + policy since landr-5aih0.7).
 *
 * Rendered at /cancel/{token}; the link arrives in every booking email. The
 * token is the SIGNED booking token — the bare booking id is no longer
 * accepted by the API.
 *
 * ⚠️ PREFETCHER SAFETY: Outlook Safe Links, Defender and virus scanners GET
 * every URL in an email. The ONE mount-time effect below calls the READ-ONLY
 * cancel-preview; cancelBooking is called from exactly one place, the
 * confirm button's onClick. Do not add an effect that mutates on mount.
 *
 * States:
 *   'loading'    — preview GET in flight
 *   'invalid'    — preview failed (bad/expired token, unknown booking):
 *                  opaque "link no longer valid" copy, no booking details
 *   'ready'      — preview loaded; renders one of
 *                    already cancelled  → the recorded refund outcome
 *                    too late           → refusal + operator contact links
 *                                         (preview.allowed=false, or the
 *                                         POST came back 409)
 *                    allowed            → "Free cancellation until …",
 *                                         refund line, Yes / No
 *   'submitting' — POST in flight; buttons disabled
 *   'success'    — cancelled; refund line from the response
 *   'error'      — POST failed for another reason; "Try again" returns to
 *                  'ready' WITHOUT calling the API
 *
 * Copy follows the booking email's language (preview.locale → de/en/es),
 * see cancelStrings.ts.
 */

type Status = 'loading' | 'invalid' | 'ready' | 'submitting' | 'success' | 'error'

interface Props {
  token: string
}

function formatDeadline(iso: string, timeZone: string, locale: CancelLocale): string {
  const date = new Date(iso)
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }).format(date)
  } catch {
    // Unknown zone name in this browser's ICU — fall back to the viewer's.
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date)
    } catch {
      return iso
    }
  }
}

function formatMoney(amount: string, currency: string, locale: CancelLocale): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      Number(amount),
    )
  } catch {
    return `${amount} ${currency}`
  }
}

function refundLine(t: CancelBundle, preview: CancelPreview, locale: CancelLocale): string {
  const amount = formatMoney(preview.refund.amount, preview.refund.currency, locale)
  if (preview.refund.method === 'stripe_auto') return fmtCancel(t.refundStripe, { amount })
  if (preview.refund.method === 'manual') {
    return fmtCancel(t.refundManual, { amount, operator: preview.operator.name })
  }
  return t.refundNone
}

function outcomeLine(
  t: CancelBundle,
  status: CancelRefundStatus | null | undefined,
  operator: string,
): string | null {
  if (status === 'refunded') return t.successRefunded
  if (status === 'manual_refund_needed') return fmtCancel(t.successManual, { operator })
  return null
}

function ContactLinks({ t, preview }: { t: CancelBundle; preview: CancelPreview }) {
  const { phone, email } = preview.operator
  if (!phone && !email) return null
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="cancel-contact">
      {phone ? (
        <a className="underline" href={`tel:${phone.replace(/\s+/g, '')}`}>
          {fmtCancel(t.contactCall, { phone })}
        </a>
      ) : null}
      {email ? (
        <a className="underline" href={`mailto:${email}`}>
          {fmtCancel(t.contactEmail, { email })}
        </a>
      ) : null}
    </div>
  )
}

export function CancelPage({ token }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [preview, setPreview] = useState<CancelPreview | null>(null)
  // Set when the POST answers 409: the window closed while the page was open.
  const [closedMeanwhile, setClosedMeanwhile] = useState(false)
  const [result, setResult] = useState<CancelBookingResponse | null>(null)

  // Read-only, exactly once per token (see the prefetcher note above).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getCancelPreview(token)
        if (cancelled) return
        setPreview(data)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const locale = normalizeCancelLocale(preview?.locale)
  const t = pickCancelBundle(locale)

  const onYes = async () => {
    setStatus('submitting')
    try {
      const res = await cancelBooking(token)
      setResult(res)
      setStatus('success')
    } catch (err) {
      if (isCancellationDeadlinePassed(err)) {
        setClosedMeanwhile(true)
        setStatus('ready')
        return
      }
      setStatus('error')
    }
  }

  const onNo = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
    // Else: leave the page as-is. Closing the tab is the natural "abandon"
    // gesture; we don't know which page (a webmail tab?) sent the user here.
  }

  if (status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.loadingTitle}</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (status === 'invalid' || !preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.invalidTitle}</CardTitle>
          <CardDescription>{t.invalidBody}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const reference = fmtCancel(t.bookingRef, { ref: preview.booking_reference })
  const header = (
    <CardDescription>
      {preview.operator.name} · <span className="font-mono">{reference}</span>
    </CardDescription>
  )
  const deadlineText = preview.deadline
    ? formatDeadline(preview.deadline, preview.timezone, locale)
    : null

  if (status === 'success') {
    const outcome = outcomeLine(t, result?.refund_status, preview.operator.name)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.successTitle}</CardTitle>
          {header}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">{t.successBody}</p>
          {outcome ? <p className="text-sm">{outcome}</p> : null}
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.errorTitle}</CardTitle>
          {header}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {fmtCancel(t.errorBody, { operator: preview.operator.name })}
          </p>
          <ContactLinks t={t} preview={preview} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStatus('ready')}>
              {t.tryAgain}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (preview.already_cancelled) {
    const outcome = outcomeLine(t, preview.refund_status, preview.operator.name)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.alreadyTitle}</CardTitle>
          {header}
        </CardHeader>
        {outcome ? (
          <CardContent>
            <p className="text-sm">{outcome}</p>
          </CardContent>
        ) : null}
      </Card>
    )
  }

  if (!preview.allowed || closedMeanwhile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.tooLateTitle}</CardTitle>
          {header}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm" data-testid="cancel-refusal">
            {deadlineText
              ? fmtCancel(t.tooLateBody, {
                  deadline: deadlineText,
                  operator: preview.operator.name,
                })
              : fmtCancel(t.tooLateBodyNoDeadline, { operator: preview.operator.name })}
          </p>
          <ContactLinks t={t} preview={preview} />
        </CardContent>
      </Card>
    )
  }

  // Allowed: 'ready' and 'submitting' share the layout; the buttons disable
  // while the POST is in flight (the API treats a double submit as an
  // idempotent OK, but a busy state is clearer).
  const busy = status === 'submitting'
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        {header}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {deadlineText ? (
          <p className="text-sm font-medium" data-testid="cancel-deadline">
            {fmtCancel(t.freeUntil, { deadline: deadlineText })}
          </p>
        ) : null}
        <p className="text-sm" data-testid="cancel-refund">
          {refundLine(t, preview, locale)}
        </p>
        {preview.policy_text ? (
          <p className="text-muted-foreground whitespace-pre-line text-xs">
            {preview.policy_text}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">{t.confirmBody}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onYes()
            }}
            disabled={busy}
          >
            {busy ? t.busy : t.yes}
          </Button>
          <Button type="button" variant="outline" onClick={onNo} disabled={busy}>
            {t.no}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
