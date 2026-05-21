import { useState } from 'react'

import { cancelBooking } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Customer one-click cancel landing page (landr-sgnd).
 *
 * Rendered when the widget is loaded with a path of /cancel/{bookingId}.
 * The link arrives via the booking_confirmation email's {cancel_url}
 * variable. Email pre-fetchers (Outlook Safe Links, Defender, virus
 * scanners) often GET any URL they see, so we deliberately render a
 * confirm step here instead of cancelling on page load — the actual
 * POST to the API only fires when the human clicks "Yes, cancel".
 *
 * States:
 *   - 'confirm' (initial): "Are you sure?" with Yes / No buttons
 *   - 'submitting': spinner-ish disabled state while the POST is in flight
 *   - 'success':  "Cancelled. Sorry to see you go."
 *   - 'error':    network or 4xx error from the API
 *
 * 'No' just navigates back in history — there's nowhere else to go
 * inside this page (the widget root would re-render the booking flow
 * for a fresh booking, which is misleading after arriving here from
 * a confirmation email).
 */

type Status = 'confirm' | 'submitting' | 'success' | 'error'

interface Props {
  bookingId: string
}

export function CancelPage({ bookingId }: Props) {
  const [status, setStatus] = useState<Status>('confirm')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onYes = async () => {
    setStatus('submitting')
    setErrorMessage(null)
    try {
      await cancelBooking(bookingId)
      setStatus('success')
    } catch (err) {
      // Surface a short, generic message — the underlying HttpError
      // includes the FastAPI 404 body, which is not user-friendly.
      // Stays opaque on purpose (we never want to leak booking-id
      // enumeration cues from a public page).
      setErrorMessage(
        err instanceof Error && err.message
          ? 'We could not cancel this booking. The link may be invalid or already used.'
          : 'Something went wrong. Please try again later.',
      )
      setStatus('error')
    }
  }

  const onNo = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
    // Else: leave the page as-is. Closing the tab is the natural
    // "abandon" gesture; we don't navigate anywhere because we don't
    // know which page sent the user here (could be a webmail tab they
    // want to return to).
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking cancelled</CardTitle>
          <CardDescription>Sorry to see you go.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Your booking has been cancelled. You can close this window.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cancellation failed</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {errorMessage ?? 'Something went wrong.'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatus('confirm')
                setErrorMessage(null)
              }}
            >
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 'confirm' and 'submitting' share the same layout; the buttons just
  // disable while the POST is in flight so a double-click can't fire
  // two requests (the API would treat the second as idempotent OK,
  // but a busy state is clearer to the customer).
  const busy = status === 'submitting'
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancel your booking?</CardTitle>
        <CardDescription>
          This will cancel your booking right away. You cannot undo this.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Booking <span className="font-mono">{bookingId}</span>
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onYes()
            }}
            disabled={busy}
          >
            {busy ? 'Cancelling…' : 'Yes, cancel booking'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onNo}
            disabled={busy}
          >
            No, keep booking
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
