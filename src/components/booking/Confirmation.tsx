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
          Reference <span className="font-mono">{response.reference}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          You will receive a confirmation email shortly with the next steps. The booking
          is currently <span className="font-medium">{response.state}</span> while the
          operator confirms capacity.
        </p>
        <p className="text-xs text-muted-foreground">
          Booking ID <span className="font-mono">{response.booking_id}</span>
        </p>
        <div>
          <Button type="button" variant="outline" onClick={onRestart}>
            Make another booking
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
