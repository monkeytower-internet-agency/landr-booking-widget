import { useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { submitBooking } from '@/api/client'
import type {
  AvailabilitySlot,
  Product,
  ProductLine,
  SubmitBookingBody,
  SubmitBookingResponse,
} from '@/api/types'
import { deriveStayWindow, type RoomSelection } from './accommodationCalc'
import type { AddonSelection } from './addonsState'
import { formatDayLabel, formatDayRange } from './dateLabel'

export type BookingSelection =
  | { kind: 'slot'; slot: AvailabilitySlot }
  | { kind: 'days'; selectedDays: string[] }

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { browserLocale, browserTimezone } from '@/lib/locale'

const participantSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

const formSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  participants: z.array(participantSchema).min(1, 'At least one participant'),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  operatorSlug: string
  product: Product
  selection: BookingSelection
  pickupLocationId: string | null
  /**
   * Total participants captured by ParticipantsStep upstream
   * (landr-mbge). The form pre-renders this many participant rows so
   * the customer fills in N name slots instead of manually clicking
   * "Add participant" N times. Defaults to 1 for safety (in case a
   * caller forgets to thread it through).
   */
  participantCount?: number
  /**
   * Additional hotel_room line items captured by the AccommodationStep
   * (landr-vyaz). Empty array when the product has no hotel offering or
   * the customer opted out. Each entry becomes one extra booking_products
   * row server-side via the existing public_submit_booking RPC, which
   * already iterates the `products` array.
   */
  accommodationRooms?: RoomSelection[]
  /**
   * Add-on line items captured upstream — either from the
   * AccommodationStep (one entry per room add-on the customer picked)
   * or from the ServiceAddonsStep for service products without a hotel
   * offering (landr-cip6). Same line-item shape as accommodationRooms;
   * gets merged into the submit `products` array.
   */
  addons?: AddonSelection[]
  onBack: () => void
  onConfirmed: (response: SubmitBookingResponse, email: string) => void
}

const cancellationDeadline = (slotDateIso: string) => {
  const d = new Date(slotDateIso)
  d.setUTCDate(d.getUTCDate() - 2)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

const firstSelectionDate = (selection: BookingSelection): string => {
  if (selection.kind === 'slot') return selection.slot.date
  return selection.selectedDays[0] ?? ''
}

const describeSelection = (
  selection: BookingSelection,
  locale: string,
): string => {
  if (selection.kind === 'slot') {
    const { date, start_time } = selection.slot
    const label = formatDayLabel(date, locale)
    return start_time ? `${label} · ${start_time.slice(0, 5)}` : label
  }
  const days = selection.selectedDays
  if (days.length === 0) return ''
  if (days.length === 1) return formatDayLabel(days[0]!, locale)
  return `${formatDayRange(days[0]!, days[days.length - 1]!, locale)} (${days.length} days)`
}

export function BookingForm({
  operatorSlug,
  product,
  selection,
  pickupLocationId,
  participantCount,
  accommodationRooms,
  addons,
  onBack,
  onConfirmed,
}: Props) {
  // landr-mbge: ParticipantsStep upstream fixed the count, so the form
  // pre-renders that many participant rows. Clamp to >=1 in case a
  // caller passes 0 or undefined. The add/remove buttons stay
  // available as an override (worker decision documented in handoff)
  // because the legacy use case where a customer realises they need
  // one more spot at the form stage is still worth supporting; the
  // backend doesn't enforce a hard cap.
  const initialCount = Math.max(1, participantCount ?? 1)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const locale = browserLocale()
  const timezone = browserTimezone()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      participants: Array.from({ length: initialCount }, () => ({
        first_name: '',
        last_name: '',
        email: '',
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  })

  // Pre-fill first participant's first/last name + email from the
  // booker as they type. Mirrors the ProductForm slug-from-name
  // convention in landr-dashboard: keep syncing forward as long as the
  // target field is empty OR still matches the *previous* booker
  // value. Once the user types something different in the participant
  // field, the two values diverge and the sync stops naturally.
  // landr-qs8d extends this to the optional participant email.
  const prevBooker = useRef({ first: '', last: '', email: '' })

  const syncParticipantFirst = (next: string) => {
    const current = getValues('participants.0.first_name') ?? ''
    if (current === '' || current === prevBooker.current.first) {
      setValue('participants.0.first_name', next, { shouldValidate: false })
    }
    prevBooker.current.first = next
  }

  const syncParticipantLast = (next: string) => {
    const current = getValues('participants.0.last_name') ?? ''
    if (current === '' || current === prevBooker.current.last) {
      setValue('participants.0.last_name', next, { shouldValidate: false })
    }
    prevBooker.current.last = next
  }

  const syncParticipantEmail = (next: string) => {
    const current = getValues('participants.0.email') ?? ''
    if (current === '' || current === prevBooker.current.email) {
      setValue('participants.0.email', next, { shouldValidate: false })
    }
    prevBooker.current.email = next
  }

  const bookerFirst = register('first_name')
  const bookerLast = register('last_name')
  const bookerEmail = register('email')

  // Derive the hotel check-in/check-out window when the booking
  // includes room line items (landr-vyaz). The widget intentionally
  // shows this for the GUIDED date range only — slot-style bookings
  // never carry rooms today.
  const selectedDays =
    selection.kind === 'days' ? selection.selectedDays : []
  const hasRooms = (accommodationRooms?.length ?? 0) > 0
  const stay = hasRooms ? deriveStayWindow(selectedDays) : null
  const showTimezone = product.service_time_shape === 'time_slot'

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const selectedDaysForSubmit =
        selection.kind === 'slot' ? [selection.slot.date] : selection.selectedDays
      // Build the primary service line + any hotel_room line items
      // captured by AccommodationStep. The public_submit_booking RPC
      // already iterates products[] and inserts N booking_products
      // rows (landr-vyaz: no API-side change needed for multi-line
      // submit). Hotel rooms share the same selected_days as the
      // service so the pricing engine multiplies by len(selected_days)+1
      // nights (landr-kd5t).
      // landr-cip6: each add-on becomes its own booking_products line
      // item alongside the parent service line + any room lines. The
      // pricing engine handles per-line totals server-side; the widget
      // only needs to emit the rows.
      const productLines: ProductLine[] = [
        {
          product_id: product.product_id,
          quantity: 1,
          selected_days: selectedDaysForSubmit,
        },
        ...(accommodationRooms ?? []).map<ProductLine>((room) => ({
          product_id: room.productId,
          quantity: room.quantity,
          selected_days: selectedDaysForSubmit,
        })),
        ...(addons ?? []).map<ProductLine>((addon) => ({
          product_id: addon.productId,
          quantity: addon.quantity,
          selected_days: selectedDaysForSubmit,
        })),
      ]
      const body: SubmitBookingBody = {
        operator_slug: operatorSlug,
        customer_first_name: values.first_name,
        customer_last_name: values.last_name,
        customer_email: values.email,
        customer_phone: values.phone || null,
        customer_preferred_locale: locale,
        cancellation_deadline: cancellationDeadline(firstSelectionDate(selection)),
        booking_channel: 'public_website',
        products: productLines,
        participants: values.participants.map((p) => ({
          first_name: p.first_name,
          last_name: p.last_name || null,
          email: p.email || null,
          service_role_code: 'participant',
          pickup_location_id: pickupLocationId ?? null,
        })),
      }
      const result = await submitBooking(body)
      onConfirmed(result, values.email)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your details</CardTitle>
        <CardDescription>
          {product.name} · {describeSelection(selection, locale)}
          {showTimezone ? ` · ${timezone}` : ''}
        </CardDescription>
        {stay && stay.checkInIso && stay.checkOutIso ? (
          <div
            className="bg-muted/40 mt-2 rounded-md border px-3 py-2 text-sm"
            data-testid="hotel-stay-block"
          >
            <div className="font-medium">
              Hotel: {formatDayLabel(stay.checkInIso, locale)} check-in →{' '}
              {formatDayLabel(stay.checkOutIso, locale)} check-out (
              {stay.nights} {stay.nights === 1 ? 'night' : 'nights'})
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Paid directly to hotel — not included in your booking total.
            </p>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" error={errors.first_name?.message}>
              <Input
                {...bookerFirst}
                autoComplete="given-name"
                onChange={(e) => {
                  bookerFirst.onChange(e)
                  syncParticipantFirst(e.target.value)
                }}
              />
            </Field>
            <Field label="Last name" error={errors.last_name?.message}>
              <Input
                {...bookerLast}
                autoComplete="family-name"
                onChange={(e) => {
                  bookerLast.onChange(e)
                  syncParticipantLast(e.target.value)
                }}
              />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...bookerEmail}
                autoComplete="email"
                onChange={(e) => {
                  bookerEmail.onChange(e)
                  syncParticipantEmail(e.target.value)
                }}
              />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input type="tel" {...register('phone')} autoComplete="tel" />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-3 border-t pt-4">
            <legend className="text-sm font-medium">Participants</legend>
            {fields.map((field, idx) => (
              <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Field
                  label={`Participant ${idx + 1} first name`}
                  error={errors.participants?.[idx]?.first_name?.message}
                >
                  <Input {...register(`participants.${idx}.first_name`)} />
                </Field>
                <Field label="Last name">
                  <Input {...register(`participants.${idx}.last_name`)} />
                </Field>
                <Field
                  label="Email (optional)"
                  error={errors.participants?.[idx]?.email?.message}
                >
                  <Input type="email" {...register(`participants.${idx}.email`)} />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(idx)}
                    disabled={fields.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ first_name: '', last_name: '', email: '' })}
              >
                Add participant
              </Button>
            </div>
          </fieldset>

          {serverError ? (
            <p className="text-sm text-destructive">{serverError}</p>
          ) : null}

          <div className="flex justify-between pt-2">
            <Button variant="outline" type="button" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Request booking'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
