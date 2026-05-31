import type { SubmitBookingResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Props {
  response: SubmitBookingResponse
  onRestart: () => void
}

export function Confirmation({ response, onRestart }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking received</CardTitle>
        <CardDescription>
          Reference <span className="font-mono">{response.booking_id}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          You will receive a confirmation email shortly with the next steps. The booking
          is currently <span className="font-medium">{response.semantic_state}</span> while the
          operator confirms capacity.
        </p>
        {/*
          landr-3vr5: customer-facing "Add to calendar" link backed by the
          per-booking .ics endpoint. Rendered as an anchor (not a button)
          because the response is a file download — anchors give native
          right-click / long-press behaviour on every platform without
          extra JS. Hidden gracefully when the API omits ical_url (older
          deploys, or when no booking-products carry dates yet).
         */}
        {response.ical_url ? (
          <div>
            <Button asChild type="button" variant="outline">
              <a
                href={response.ical_url}
                download={`landr-booking-${response.booking_id}.ics`}
              >
                Add to calendar
              </a>
            </Button>
          </div>
        ) : null}
        <div>
          <Button type="button" variant="outline" onClick={onRestart}>
            Make another booking
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
