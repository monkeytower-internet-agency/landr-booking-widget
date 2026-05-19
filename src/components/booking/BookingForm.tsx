import { useState } from 'react'
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
import type { RoomSelection } from './accommodationCalc'

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
   * Additional hotel_room line items captured by the AccommodationStep
   * (landr-vyaz). Empty array when the product has no hotel offering or
   * the customer opted out. Each entry becomes one extra booking_products
   * row server-side via the existing public_submit_booking RPC, which
   * already iterates the `products` array.
   */
  accommodationRooms?: RoomSelection[]
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

const describeSelection = (selection: BookingSelection): string => {
  if (selection.kind === 'slot') {
    const { date, start_time } = selection.slot
    return start_time ? `${date} · ${start_time.slice(0, 5)}` : date
  }
  const days = selection.selectedDays
  if (days.length === 0) return ''
  if (days.length === 1) return days[0]!
  return `${days[0]} – ${days[days.length - 1]} (${days.length} days)`
}

export function BookingForm({
  operatorSlug,
  product,
  selection,
  pickupLocationId,
  accommodationRooms,
  onBack,
  onConfirmed,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const locale = browserLocale()
  const timezone = browserTimezone()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      participants: [{ first_name: '', last_name: '', email: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const selectedDays =
        selection.kind === 'slot' ? [selection.slot.date] : selection.selectedDays
      // Build the primary service line + any hotel_room line items
      // captured by AccommodationStep. The public_submit_booking RPC
      // already iterates products[] and inserts N booking_products
      // rows (landr-vyaz: no API-side change needed for multi-line
      // submit). Hotel rooms share the same selected_days as the
      // service so the pricing engine multiplies by len(selected_days)+1
      // nights (landr-kd5t).
      const productLines: ProductLine[] = [
        {
          product_id: product.product_id,
          quantity: 1,
          selected_days: selectedDays,
        },
        ...(accommodationRooms ?? []).map<ProductLine>((room) => ({
          product_id: room.productId,
          quantity: room.quantity,
          selected_days: selectedDays,
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
          {product.name} · {describeSelection(selection)} · {timezone}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" error={errors.first_name?.message}>
              <Input {...register('first_name')} autoComplete="given-name" />
            </Field>
            <Field label="Last name" error={errors.last_name?.message}>
              <Input {...register('last_name')} autoComplete="family-name" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register('email')} autoComplete="email" />
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
