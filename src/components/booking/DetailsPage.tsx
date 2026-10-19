import { useEffect, useState } from 'react'
import { getBookingByToken, getBookingDetails, HttpError } from '@/api/client'
import type { CustomerDetails } from '@/api/customerDetailsTypes'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { browserLocale, configureCustomerLocale } from '@/lib/locale'
import { CustomerDetailsForm } from './CustomerDetailsForm'
import { fmtDetails, pickDetailsBundle } from './detailsStrings'

/**
 * Customer "complete your details" page (landr-kcxx5.4), rendered at
 * /details/{token}. The link arrives by email for a booking staff created (or
 * a custom offer) whose product forms the operator did not fill.
 *
 * ⚠️ PREFETCHER SAFETY: mail scanners GET every link. The mount effect only
 * READS (GET /details, plus a best-effort read of the operator's name); the
 * PUT happens solely from the form's Submit click.
 *
 * States: loading → ready (form) | nothing (not pending) | invalid (401/404)
 * | error (anything else, retryable); done after a successful save.
 */
type Status = 'loading' | 'ready' | 'nothing' | 'invalid' | 'error' | 'done'

interface Props {
  token: string
}

export function DetailsPage({ token }: Props) {
  // Standalone token page: no operator settings fetch, so no whitelist.
  configureCustomerLocale(null, null)
  const t = pickDetailsBundle(browserLocale())

  const [status, setStatus] = useState<Status>('loading')
  const [details, setDetails] = useState<CustomerDetails | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    document.title = t.pageTitle
  }, [t.pageTitle])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getBookingDetails(token)
        if (cancelled) return
        setDetails(data)
        setStatus(data.pending ? 'ready' : 'nothing')
      } catch (err) {
        if (cancelled) return
        const bad = err instanceof HttpError && (err.status === 401 || err.status === 404)
        setStatus(bad ? 'invalid' : 'error')
        return
      }
      // The details payload carries no operator; the offer read does.
      // Best effort: the page works (generic wording) without it.
      try {
        const offer = await getBookingByToken(token)
        if (!cancelled) setOperatorName(offer.operator_name || null)
      } catch {
        // generic wording
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, attempt])

  const op = operatorName ? { operator: operatorName } : null

  if (status === 'loading') {
    return (
      <Card data-testid="details-loading">
        <CardHeader>
          <CardTitle>{t.loadingTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.loadingBody}</p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'invalid') {
    return (
      <Card data-testid="details-invalid">
        <CardHeader>
          <CardTitle>{t.invalidTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{t.invalidBody}</p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card data-testid="details-error">
        <CardHeader>
          <CardTitle>{t.errorTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{t.errorBody}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStatus('loading')
              setAttempt((n) => n + 1)
            }}
          >
            {t.retry}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status === 'nothing') {
    return (
      <Card data-testid="details-nothing">
        <CardHeader>
          <CardTitle>{t.nothingTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{op ? fmtDetails(t.nothingBody, op) : t.nothingBodyNoOperator}</p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'done') {
    return (
      <Card data-testid="details-done">
        <CardHeader>
          <CardTitle>{t.doneTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{op ? fmtDetails(t.doneBody, op) : t.doneBodyNoOperator}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="details-ready">
      <Card>
        <CardHeader>
          <CardTitle>{t.pageTitle}</CardTitle>
          <CardDescription>{op ? fmtDetails(t.intro, op) : t.introNoOperator}</CardDescription>
        </CardHeader>
      </Card>
      {details ? (
        <CustomerDetailsForm
          token={token}
          details={details}
          operatorName={operatorName}
          onSaved={() => setStatus('done')}
        />
      ) : null}
    </div>
  )
}
