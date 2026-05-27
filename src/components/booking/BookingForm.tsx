import { useState } from 'react'
import { HttpError, submitBooking } from '@/api/client'
import type {
  AvailabilitySlot,
  Product,
  ProductLine,
  SubmitBookingBody,
  SubmitBookingResponse,
} from '@/api/types'
import {
  deriveStayWindow,
  stayNightIsos,
  type RoomAssignmentMap,
  type RoomSelection,
} from './accommodationCalc'
import type { AddonSelection } from './addonsState'
import { formatDayLabel, formatDayRange } from './dateLabel'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'

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
import { browserLocale, browserTimezone } from '@/lib/locale'
import { StepBackButton } from './StepBackButton'

interface Props {
  widgetToken: string
  /**
   * landr-7zc5.3: operator preview token. When present the submit body
   * carries preview_token so the API accepts bookings against draft products.
   * Absent for all normal customer-facing embeds.
   */
  previewToken?: string
  product: Product
  selection: BookingSelection
  /**
   * Booker contact details captured upstream by DetailsStep (landr-8c03).
   * Required — the BookingForm is review-only and no longer collects
   * input. Callers that previously omitted booker fields must update.
   */
  booker: BookerDetails
  /**
   * Full participant roster captured by DetailsStep (landr-8c03) —
   * includes the booker as participant 1 plus any additional people.
   * Threaded through into the submit payload's participants[] array.
   */
  participants: ParticipantDetails[]
  pickupLocationId: string | null
  /**
   * Additional hotel_room line items captured by the AccommodationStep
   * (landr-vyaz). Empty array when the product has no hotel offering or
   * the customer opted out.
   */
  accommodationRooms?: RoomSelection[]
  /**
   * Add-on line items captured upstream — from AccommodationStep
   * (per-room add-ons) or ServiceAddonsStep (landr-cip6).
   */
  addons?: AddonSelection[]
  /**
   * landr-sbhz.3: pre-booking customer declarations. When present,
   * both fields are included in the submit body. Omitted for operators
   * that have not adopted the declarations feature.
   */
  customerDeclarations?: Record<string, true> | null
  /**
   * landr-sbhz.3: customer's chosen spoken language (BCP-47 code).
   * Required alongside customerDeclarations for enforcing operators.
   */
  customerLanguage?: string | null
  /**
   * landr-ffyg.2: "second pilot in a shared double room" mode. When true
   * the submit carries the top-level is_shared_double=true (landr-ffyg.1),
   * accommodationRooms is empty (no hotel_room lines), and the
   * pickupLocationId is the shared hotel. Defaults false.
   */
  isSharedDouble?: boolean
  /**
   * landr-gb2f.2: participant → room assignment map (participantIndex →
   * {roomProductId, unitIndex}), captured by AccommodationStep in package
   * mode. Each assigned participant gets room_product_id + room_unit_index
   * attached to its participants[] entry on submit; unassigned participants
   * (and all participants in guiding-only / shared-double modes) send
   * null/omit. Defaults to empty — the products[] line items are NOT
   * affected by this assignment (PINNED wire contract, landr-gb2f.3/.4).
   */
  roomAssignment?: RoomAssignmentMap
  onBack: () => void
  onConfirmed: (response: SubmitBookingResponse, email: string) => void
}

/**
 * Default cancellation deadline: 24 h before midnight UTC of the first
 * booked day (landr-piyv). The widget always sends *something* because
 * the API marks the field required; the server stores it on the booking
 * row but does not enforce cancellation logic at submit time, so the
 * exact policy can evolve without breaking submits. Operator-configurable
 * deadlines are a future enhancement.
 */
const cancellationDeadline = (slotDateIso: string) => {
  const d = new Date(slotDateIso)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}

/**
 * Pretty-print a FastAPI 422 `detail` payload. Pydantic emits an array
 * of {loc, msg, type} entries — we surface up to the first few as
 * "field: message" lines so the user sees the actual contract issue
 * instead of an opaque "Failed to fetch". Falls back to the raw
 * stringified detail when the shape is unexpected.
 */
const formatHttpError = (err: HttpError): string => {
  if (err.status === 422 && Array.isArray(err.detail)) {
    const lines = err.detail
      .slice(0, 4)
      .map((entry: unknown) => {
        if (entry && typeof entry === 'object') {
          const e = entry as { loc?: unknown[]; msg?: string }
          const path = Array.isArray(e.loc)
            ? e.loc.filter((p) => p !== 'body').join('.')
            : ''
          const msg = e.msg ?? 'invalid value'
          return path ? `${path}: ${msg}` : msg
        }
        return String(entry)
      })
    return `Booking rejected (422): ${lines.join('; ')}`
  }
  if (err.status >= 400 && err.detail && typeof err.detail === 'string') {
    return `Booking rejected (${err.status}): ${err.detail}`
  }
  return err.message
}

const firstSelectionDate = (selection: BookingSelection): string => {
  if (selection.kind === 'slot') return selection.slot.date
  return selection.selectedDays[0] ?? ''
}

/**
 * Short selection summary for the review card. Mirrors DetailsStep
 * (landr-2wyi): the persistent PriceSidebar carries day chips for
 * multi-day picks, so we collapse them to a count here instead of
 * repeating the misleading "first → last (N days)" range that
 * conflated non-contiguous selections with a contiguous span.
 */
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
  return `${days.length} days selected`
}

/**
 * BookingForm — review-only step (landr-8c03). All inputs (booker
 * contact, participant names/emails/phones) are now collected upstream
 * in the DetailsStep. This screen renders a read-only summary of every
 * choice the customer has made — dates, participants, accommodation,
 * pickup — and a single Confirm button that POSTs the assembled
 * submit_booking payload. The PriceSidebar in the right rail (or
 * mobile drawer) carries the financial summary, so the review card
 * sticks to the WHAT (dates / who / where) and leaves the HOW MUCH to
 * the sidebar.
 */
export function BookingForm({
  widgetToken,
  previewToken,
  product,
  selection,
  booker,
  participants,
  pickupLocationId,
  accommodationRooms,
  addons,
  customerDeclarations,
  customerLanguage,
  isSharedDouble = false,
  roomAssignment,
  onBack,
  onConfirmed,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const locale = browserLocale()
  const timezone = browserTimezone()

  // Derive the hotel check-in/check-out window when the booking
  // includes room line items (landr-vyaz). The widget intentionally
  // shows this for the GUIDED date range only — slot-style bookings
  // never carry rooms today.
  const selectedDays =
    selection.kind === 'days' ? selection.selectedDays : []
  const hasRooms = (accommodationRooms?.length ?? 0) > 0
  const stay = hasRooms ? deriveStayWindow(selectedDays) : null
  const showTimezone = product.service_time_shape === 'time_slot'

  const onConfirm = async () => {
    setServerError(null)
    setSubmitting(true)
    try {
      const selectedDaysForSubmit =
        selection.kind === 'slot' ? [selection.slot.date] : selection.selectedDays
      // Hotel-room lines book the night window (check-in → check-out
      // exclusive) — distinct from the service's selected_days. Empty
      // when the customer chose no rooms or picked a slot-style service.
      const nightIsos = stayNightIsos(selectedDaysForSubmit)
      // Build the primary service line + any hotel_room line items
      // captured by AccommodationStep (landr-vyaz: public_submit_booking
      // already iterates products[]). Add-ons become their own lines
      // (landr-cip6). Service add-ons piggyback on the service days;
      // room-tied add-ons (e.g. breakfast) intentionally use the same
      // service-day window today — the engine prices per-line based on
      // quantity × per_unit × len(selected_days), so for daily add-ons
      // the two windows produce the same total (selectedDays.length).
      const productLines: ProductLine[] = [
        {
          product_id: product.product_id,
          quantity: 1,
          selected_days: selectedDaysForSubmit,
        },
        ...(accommodationRooms ?? []).map<ProductLine>((room) => ({
          product_id: room.productId,
          quantity: room.quantity,
          selected_days: nightIsos,
        })),
        ...(addons ?? []).map<ProductLine>((addon) => ({
          product_id: addon.productId,
          quantity: addon.quantity,
          selected_days: selectedDaysForSubmit,
        })),
      ]
      // Drop participant phone before submit — backend ParticipantIn
      // doesn't accept it yet (follow-up filed in landr-8c03 handoff).
      // The booker phone goes through as customer_phone as before.
      const body: SubmitBookingBody = {
        widget_token: widgetToken,
        customer_first_name: booker.first_name,
        customer_last_name: booker.last_name,
        customer_email: booker.email,
        customer_phone: booker.phone || null,
        customer_preferred_locale: locale,
        cancellation_deadline: cancellationDeadline(firstSelectionDate(selection)),
        booking_channel: 'public_website',
        products: productLines,
        participants: participants.map((p, idx) => {
          // landr-gb2f.2: attach the participant's assigned hotel_room unit
          // (room_product_id + room_unit_index, PINNED wire contract). The
          // assignment map is keyed by participant index. Unassigned (and
          // every participant in guiding-only / shared-double modes, where
          // the map is empty) sends both fields as null. products[] line
          // items are NOT affected.
          const assigned = roomAssignment?.[idx]
          return {
            first_name: p.first_name,
            last_name: p.last_name || null,
            email: p.email || null,
            // landr-zaan: per-participant phone now round-trips to
            // contacts.phone server-side (no longer dropped). Normalised to
            // null when the field is blank so the RPC's COALESCE-update
            // never overwrites an existing phone with an empty string.
            phone: p.phone || null,
            // landr-mg0a: pick the participant's chosen role (set by
            // DetailsStep). Falls back to the legacy hardcoded 'participant'
            // code in the rare race where DetailsStep submitted before the
            // App-mount service-roles fetch resolved — every operator now
            // has a 'participant' row seeded by the AFTER INSERT trigger,
            // so the fallback path stays valid for fresh tenants too.
            service_role_code: p.service_role_code || 'participant',
            pickup_location_id: pickupLocationId ?? null,
            room_product_id: assigned ? assigned.roomProductId : null,
            room_unit_index: assigned ? assigned.unitIndex : null,
          }
        }),
        // landr-sbhz.3: thread declarations + language through to the
        // submit payload. Only included when they were collected upstream
        // by DeclarationsStep (non-null). Omitted for operators that have
        // not adopted the declarations feature.
        ...(customerDeclarations != null
          ? { customer_declarations: customerDeclarations }
          : {}),
        ...(customerLanguage != null
          ? { customer_language: customerLanguage }
          : {}),
        // landr-ffyg.2: top-level shared-double marker (landr-ffyg.1).
        // Always sent — true for the second-pilot-sharing mode (in which
        // case accommodationRooms is empty so no hotel_room line ships and
        // pickupLocationId is the shared hotel), false for every other
        // mode. The API persists it on bookings.is_shared_double.
        is_shared_double: isSharedDouble,
      }
      // landr-7zc5.3: pass preview_token so the API can accept draft
      // products during operator preview. The option is harmlessly
      // ignored when previewToken is undefined (normal customer flow).
      const result = await submitBooking(body, previewToken ? { previewToken } : undefined)
      onConfirmed(result, booker.email)
    } catch (err) {
      if (err instanceof HttpError) {
        setServerError(formatHttpError(err))
      } else {
        setServerError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Review your booking</CardTitle>
        <CardDescription>
          {product.name} · {describeSelection(selection, locale)}
          {showTimezone ? ` · ${timezone}` : ''}
        </CardDescription>
        {stay && stay.checkInIso && stay.checkOutIso ? (
          <div
            className="bg-muted/40 mt-2 rounded-md border px-3 py-2 text-sm"
            data-testid="hotel-stay-block"
          >
            {/* landr-8yaz: weekday-prefixed dates ("Sun 24 May → Wed 28 May,
                4 nights") via formatDayRange (sibling helper in dateLabel.ts
                already pins UTC for ISO inputs). */}
            <div className="font-medium">
              Hotel: {formatDayRange(stay.checkInIso, stay.checkOutIso, locale)},{' '}
              {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Paid directly to hotel — not included in your booking total.
            </p>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Booker summary — pulled from DetailsStep upstream. */}
        <section data-testid="review-booker">
          <h3 className="mb-2 text-sm font-semibold">Your contact</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>
              {booker.first_name} {booker.last_name}
            </dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{booker.email}</dd>
            {booker.phone ? (
              <>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{booker.phone}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {/* Participants summary. participants[0] mirrors the booker, so
            we render the heading + a clear row-per-person list. */}
        <section data-testid="review-participants">
          <h3 className="mb-2 text-sm font-semibold">
            Participants ({participants.length})
          </h3>
          <ol className="space-y-1 text-sm">
            {participants.map((p, idx) => (
              <li
                key={`participant-${idx}`}
                className="flex items-baseline justify-between gap-2 border-b py-1 last:border-b-0"
              >
                <span>
                  <span className="font-medium">
                    {idx + 1}. {p.first_name} {p.last_name}
                  </span>
                  {p.email ? (
                    <span className="ml-2 text-xs text-muted-foreground break-all">
                      {p.email}
                    </span>
                  ) : null}
                  {p.phone ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.phone}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {serverError ? (
          <p className="text-sm text-destructive" data-testid="review-error">
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => void onConfirm()}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Confirm booking'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
