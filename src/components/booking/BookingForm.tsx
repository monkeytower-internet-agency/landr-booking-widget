import { useState } from 'react'
import { HttpError, submitBooking, submitStaffBooking } from '@/api/client'
import type {
  AvailabilitySlot,
  Companion,
  Product,
  ProductLine,
  SubmitBookingBody,
  SubmitBookingResponse,
} from '@/api/types'
import {
  deriveStayWindow,
  disambiguatePartyLabels,
  stayNightIsos,
  type BreakfastMap,
  type OccupantAgeMap,
  type RoomAssignmentMap,
  type RoomSelection,
} from './accommodationCalc'
import type { AddonSelection } from './addonsState'
import type { PerRoomAddons } from '@/appStepMachine'
import { formatDayLabel, formatDayRange } from './dateLabel'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from './detailsTypes'

export type BookingSelection =
  | {
      kind: 'slot'
      slot: AvailabilitySlot
      /**
       * landr-aoak.2 [S3]: set when an operator (staff mode) force-booked a
       * full / blocked fixed-date window. Carried through to the submit adapter
       * which raises the booking-level ignore_capacity flag. Undefined / false
       * for every normal customer selection (the byte-identical path).
       */
      forced?: boolean
    }
  | {
      kind: 'days'
      selectedDays: string[]
      /**
       * landr-aoak.2 [S3]: the subset of selectedDays the operator force-booked
       * past zero availability (blocked / sold-out days). Empty / undefined for
       * normal customer selections. Drives the submit adapter's force flag.
       */
      forcedDays?: string[]
    }

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
import { StepBackButton } from './StepBackButton'
import { useStaffMode, resolveParentTargetOrigin } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import {
  augmentStaffSubmit,
  isStaffSubmitBody,
  type PriceOverride,
} from './staffSubmitAdapter'

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
  /**
   * landr-87n9.3: non-guiding companions collected by DetailsStep. Sent as
   * the submit body's top-level `companions: Companion[]` (PINNED wire
   * contract — landr-87n9.5 on the API builds the same shape). Each
   * companion's room assignment comes from the whole-party `roomAssignment`
   * map at index >= participants.length (the unified party index space).
   * Empty array when nobody extra joins. Companions are NOT in
   * participants[] — they carry no service_role and are not in the guiding
   * price. Defaults to empty so legacy call-sites need no change.
   */
  companions?: CompanionDetails[]
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
   * landr-87n9.4: BCP-47 codes selected by the customer from the offered
   * language list (multi-select). Replaces the legacy single customerLanguage
   * prop. Empty array or omitted when no offered language was picked (must be
   * accompanied by a non-empty customerOtherLanguages in that case).
   */
  customerLanguages?: string[] | null
  /**
   * landr-87n9.4: free-text languages spoken not covered by the offered list.
   * Null / omitted when the free-text was not filled.
   */
  customerOtherLanguages?: string | null
  /**
   * landr-ffyg.2: "second pilot in a shared double room" mode. When true
   * the submit carries the top-level is_shared_double=true (landr-ffyg.1),
   * accommodationRooms is empty (no hotel_room lines), and the
   * pickupLocationId is the shared hotel. Defaults false.
   */
  isSharedDouble?: boolean
  /**
   * landr-gb2f.2 / landr-87n9.3: WHOLE-PARTY → room assignment map
   * (memberIndex → {roomProductId, unitIndex}), captured by AccommodationStep
   * in package mode. The index space is unified: indices 0..P-1 are guiding
   * participants, indices P..P+C-1 are companions (P = participants.length).
   * Each assigned member gets room_product_id + room_unit_index attached to
   * its participants[] / companions[] entry on submit; unassigned members
   * (and all members in guiding-only / shared-double modes) send null/omit.
   * Defaults to empty — the products[] line items are NOT affected by this
   * assignment (PINNED wire contract, landr-87n9.5).
   */
  roomAssignment?: RoomAssignmentMap
  /**
   * landr-doam.1: per-occupant age band + age, captured by AccommodationStep
   * in the room-assignment UI. Unified index space (same as roomAssignment).
   * Each member with band='child' gets occupant_age_band='child' +
   * occupant_age=<age> in the submit body; all others get occupant_age_band
   * omitted (API default = adult). Purely informational for the hotel —
   * no pricing impact. Defaults to empty (all adults).
   *
   * WIRE CONTRACT (PINNED — landr-doam.2 on the API builds the same shape).
   */
  occupantAgeMap?: OccupantAgeMap
  /**
   * landr-gb2f.5: raw per-room add-on selection map from AccommodationStep.
   * Keyed by roomProductId → { addon_product_id → qty }. Used in the review
   * to show per-room breakfast status ("Single Room 1 — with breakfast" etc).
   * Absent / empty → no per-room breakfast section rendered (guiding-only,
   * shared-double, or no add-ons configured).
   */
  perRoomAddons?: PerRoomAddons
  /**
   * landr-gb2f.5: room product display names from AccommodationStep, keyed
   * by product_id. Used to label room units as "Single Room 1 — …" in the
   * per-room breakfast section. Falls back to the product_id when absent.
   */
  roomProductNames?: Record<string, string>
  /**
   * landr-a4fy: per-occupant breakfast flag map from AccommodationStep
   * (memberIndex → boolean). Unified party index space (participants 0..P-1,
   * companions P..P+C-1). When present, each Participant/Companion in the
   * submit body carries has_breakfast=true/false. Also drives the review-
   * screen breakfast display (replaces the index-order heuristic when present).
   * Absent / empty → no has_breakfast sent; review falls back to the
   * heuristic (backward-compatible).
   */
  breakfastMap?: BreakfastMap
  /**
   * landr-71kz.4: optional form_responses collected by CustomFormStep(s).
   * Each entry carries a form_key + pruned answers (hidden-field answers
   * already dropped by CustomFormStep before reaching here). Only sent
   * when the product has a configured flow with at least one custom_form
   * module — omitted for legacy-flow operators so the submit body is
   * byte-identical to the pre-71kz path. Optional for backward compat.
   */
  formResponses?: import('@/api/flowTypes').FormResponseEntry[]
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
  companions = [],
  pickupLocationId,
  accommodationRooms,
  addons,
  customerDeclarations,
  customerLanguages,
  customerOtherLanguages,
  isSharedDouble = false,
  roomAssignment,
  occupantAgeMap = {},
  perRoomAddons,
  roomProductNames,
  breakfastMap = {},
  formResponses,
  onBack,
  onConfirmed,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const locale = browserLocale()
  const timezone = browserTimezone()

  // landr-aoak.2 [S3]: staff/operator mode. When inactive, none of the staff
  // branches below render and the submit body is byte-identical to today.
  const staff = useStaffMode()
  const canOverridePrice =
    staff.active && staff.powers.includes('price_override')
  // Operator price-override inputs (amount + reason). Empty strings ⇒ no
  // override. Only ever shown / read in staff mode.
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  // landr-aoak.2: did the operator force-book past capacity? Derived from the
  // forced markers the pickers attached to the selection. Always false for a
  // normal customer selection (no forced fields present).
  const forced =
    selection.kind === 'slot'
      ? selection.forced === true
      : (selection.forcedDays?.length ?? 0) > 0
  const forcedDays =
    selection.kind === 'days' ? (selection.forcedDays ?? []) : []

  // Derive the hotel check-in/check-out window when the booking
  // includes room line items (landr-vyaz). The widget intentionally
  // shows this for the GUIDED date range only — slot-style bookings
  // never carry rooms today.
  const selectedDays =
    selection.kind === 'days' ? selection.selectedDays : []
  const hasRooms = (accommodationRooms?.length ?? 0) > 0
  const stay = hasRooms ? deriveStayWindow(selectedDays) : null
  const showTimezone = product.service_time_shape === 'time_slot'

  // landr-gb2f.4 / gb2f.5 / landr-a4fy: build the per-room-unit breakfast
  // breakdown for the review. Only rendered when we have rooms AND a
  // perRoomAddons map (i.e. the customer booked in package mode with
  // add-ons configured).
  //
  // landr-a4fy: when breakfastMap is populated (per-occupant flags from
  // the room-assignment step), derive per-unit hasBreakfast from the
  // occupants of that unit: a unit "has breakfast" when ANY assigned
  // occupant has has_breakfast=true. This is the correct authoritative
  // source once the user has toggled.
  //
  // Fallback: when breakfastMap is empty (legacy / pre-a4fy path), use
  // the index-order heuristic (first totalAddonQty units get breakfast).
  // Skipped when perRoomAddons is absent or empty (guiding-only,
  // shared-double, or no add-ons configured).
  //
  // landr-rjvd: row shape extended to carry per-occupant breakfast data so
  // the review can show WHO gets breakfast rather than collapsing to a
  // per-unit boolean. Legacy path (empty breakfastMap) retains the prior
  // per-unit rendering via hasBreakfastMapData=false.
  type ReviewRoomRow = {
    label: string
    /** Room-level breakfast state derived from per-occupant flags. */
    breakfastState: 'all' | 'some' | 'none'
    /** Per-occupant names paired with their individual breakfast flag. */
    occupants: { name: string; hasBreakfast: boolean }[]
    /** false when breakfastMap is empty → fall back to legacy per-unit display. */
    hasBreakfastMapData: boolean
    /** Legacy-only: kept for backward-compatible rendering when hasBreakfastMapData=false. */
    hasBreakfast: boolean
    /** Legacy-only: plain occupant names list (no per-occupant breakfast data). */
    occupantNames: string[]
  }
  const perRoomBreakfastRows: ReviewRoomRow[] = (() => {
    if (!perRoomAddons || !hasRooms || !accommodationRooms) return []
    // Only show this section when at least one room type has any add-on qty.
    const hasAnyAddons = Object.values(perRoomAddons).some((qtys) =>
      Object.values(qtys).some((q) => q > 0),
    )
    // landr — rooms whose breakfast is INCLUDED in the room itself (e.g.
    // "Premium Double Room with Breakfast") carry no breakfast add-on. They
    // must NEVER render as "no breakfast" — that contradicts the room name.
    // Detect them by name so the review shows "breakfast included" for them,
    // and so a pure-included-breakfast booking still surfaces the section.
    // (A structured breakfast_included flag would be more robust than name-
    // matching — tracked as a follow-up; today the operator encodes inclusion
    // in the product name.)
    const roomIncludesBreakfast = (productId: string): boolean =>
      /breakfast/i.test(roomProductNames?.[productId] ?? '')
    const hasIncludedBreakfast = accommodationRooms.some((r) =>
      roomIncludesBreakfast(r.productId),
    )
    if (!hasAnyAddons && !hasIncludedBreakfast) return []

    // landr-rxjo: use disambiguated labels so two guests with the same first
    // name are distinguishable. Party order: participants first, then
    // companions — matching the RoomAssignmentMap index space.
    const allPartyNames = disambiguatePartyLabels([
      ...participants.map((p) => ({ first: p.first_name, last: p.last_name })),
      ...companions.map((c) => ({ first: c.first_name, last: c.last_name })),
    ]).map((label, i) => {
      if (label) return label
      // Fallback for empty first name (rule 5 of disambiguatePartyLabels).
      return i < participants.length ? '?' : '?'
    })
    const hasBreakfastMapData = Object.keys(breakfastMap).length > 0
    const rows: ReviewRoomRow[] = []
    for (const room of accommodationRooms) {
      const roomName = roomProductNames?.[room.productId] ?? room.productId
      const includesBreakfast = roomIncludesBreakfast(room.productId)
      const roomAddonQtys = perRoomAddons[room.productId] ?? {}
      // Sum total add-on qty for this room type (breakfast is the only
      // per-room add-on today; if more are added we sum all of them).
      const totalAddonQty = Object.values(roomAddonQtys).reduce((a, b) => a + b, 0)
      for (let unitIndex = 0; unitIndex < room.quantity; unitIndex += 1) {
        // Build unit label: "Single Room 1" (1-based) or "Single Room" when qty=1.
        const label =
          room.quantity > 1 ? `${roomName} ${unitIndex + 1}` : roomName
        // Collect occupant first names and member indices from the assignment map.
        const occupantNames: string[] = []
        const occupantIndices: number[] = []
        if (roomAssignment) {
          for (const [memberIdxStr, entry] of Object.entries(roomAssignment)) {
            if (
              entry.roomProductId === room.productId &&
              entry.unitIndex === unitIndex
            ) {
              const memberIdx = Number(memberIdxStr)
              const name = allPartyNames[memberIdx]
              // landr-f4dm: push unconditionally so occupantNames stays
              // index-aligned with occupantIndices (a falsy name must not
              // shift the positional pairing used by the `occupants` map).
              occupantNames.push(name ?? '?')
              occupantIndices.push(memberIdx)
            }
          }
        }
        if (hasBreakfastMapData) {
          // landr-rjvd: build per-occupant pairs and derive room-level state.
          const occupants = occupantIndices.map((memberIdx, i) => ({
            name: occupantNames[i] ?? '?',
            // Included-breakfast rooms: every occupant gets breakfast (it's
            // baked into the room). Otherwise honour the per-occupant add-on.
            hasBreakfast: includesBreakfast || breakfastMap[memberIdx] === true,
          }))
          const withCount = occupants.filter((o) => o.hasBreakfast).length
          const breakfastState: 'all' | 'some' | 'none' = includesBreakfast
            ? 'all'
            : withCount === occupants.length && occupants.length > 0
              ? 'all'
              : withCount > 0
                ? 'some'
                : 'none'
          rows.push({
            label,
            breakfastState,
            occupants,
            hasBreakfastMapData: true,
            // Legacy fields not used in this path but kept for type completeness.
            hasBreakfast: includesBreakfast || withCount > 0,
            occupantNames,
          })
        } else {
          // Legacy: included-breakfast rooms always count; otherwise distribute
          // breakfast sequentially — first totalAddonQty units get it.
          const hasBreakfast = includesBreakfast || unitIndex < totalAddonQty
          rows.push({
            label,
            breakfastState: hasBreakfast ? 'all' : 'none',
            occupants: [],
            hasBreakfastMapData: false,
            hasBreakfast,
            occupantNames,
          })
        }
      }
    }
    return rows
  })()

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
          // landr-doam.1: per-occupant age band + age (hotel informational).
          // Absent/null = adult (default). Only 'child' sends occupant_age.
          const ageEntry = occupantAgeMap[idx]
          const isChild = ageEntry?.band === 'child'
          // landr-a4fy: per-occupant breakfast flag. Omit when false/absent
          // to keep the payload compact (API default = false).
          const hasBreakfast = breakfastMap[idx] === true
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
            // landr-doam.1 wire fields (PINNED contract — landr-doam.2):
            // omit when adult (default) to keep the payload compact.
            ...(isChild
              ? {
                  occupant_age_band: 'child' as const,
                  occupant_age: ageEntry.age ?? null,
                }
              : {}),
            // landr-a4fy wire field (PINNED contract):
            // omit when false to keep the payload compact.
            ...(hasBreakfast ? { has_breakfast: true as const } : {}),
          }
        }),
        // landr-87n9.3: non-guiding companions as the top-level companions[]
        // (PINNED wire contract — landr-87n9.5 builds the same shape). Each
        // companion's room assignment lives in the WHOLE-PARTY roomAssignment
        // map at index participants.length + companionIdx (the unified party
        // index space: participants first, companions after). Unassigned (and
        // every companion in guiding-only / shared-double modes, where the
        // map is empty) sends both room fields as null. Optional fields
        // normalised to null when blank.
        ...(companions.length > 0
          ? {
              companions: companions.map<Companion>((c, cIdx) => {
                const memberIdx = participants.length + cIdx
                const assigned = roomAssignment?.[memberIdx]
                // landr-doam.1: per-occupant age band + age for companions.
                const ageEntry = occupantAgeMap[memberIdx]
                const isChild = ageEntry?.band === 'child'
                // landr-a4fy: per-occupant breakfast flag for companions.
                const hasBreakfast = breakfastMap[memberIdx] === true
                return {
                  first_name: c.first_name,
                  last_name: c.last_name || null,
                  email: c.email || null,
                  phone: c.phone || null,
                  room_product_id: assigned ? assigned.roomProductId : null,
                  room_unit_index: assigned ? assigned.unitIndex : null,
                  // landr-doam.1 wire fields (PINNED contract — landr-doam.2):
                  // omit when adult (default) to keep the payload compact.
                  ...(isChild
                    ? {
                        occupant_age_band: 'child' as const,
                        occupant_age: ageEntry.age ?? null,
                      }
                    : {}),
                  // landr-a4fy wire field (PINNED contract):
                  // omit when false to keep the payload compact.
                  ...(hasBreakfast ? { has_breakfast: true as const } : {}),
                  // landr-doam.1 scope-add: companion kind (PINNED contract).
                  // Omit when 'guest' (the API default) to keep payload compact.
                  ...(c.companion_kind === 'separate_guiding'
                    ? { companion_kind: 'separate_guiding' as const }
                    : {}),
                }
              }),
            }
          : {}),
        // landr-sbhz.3: thread declarations through to the submit payload.
        // Only included when they were collected upstream by DeclarationsStep
        // (non-null). Omitted for operators that have not adopted the
        // declarations feature.
        ...(customerDeclarations != null
          ? { customer_declarations: customerDeclarations }
          : {}),
        // landr-87n9.4: multi-select languages + free-text other. Send when
        // the declarations step was shown (i.e. when customerDeclarations is
        // non-null — they are always collected together). Omit otherwise so
        // non-declarations operators get a clean payload.
        ...(customerDeclarations != null && customerLanguages != null
          ? { customer_languages: customerLanguages }
          : {}),
        ...(customerDeclarations != null && customerOtherLanguages != null
          ? { customer_other_languages: customerOtherLanguages }
          : {}),
        // landr-ffyg.2: top-level shared-double marker (landr-ffyg.1).
        // Always sent — true for the second-pilot-sharing mode (in which
        // case accommodationRooms is empty so no hotel_room line ships and
        // pickupLocationId is the shared hotel), false for every other
        // mode. The API persists it on bookings.is_shared_double.
        is_shared_double: isSharedDouble,
        // landr-71kz.4: form_responses from CustomFormStep(s). Optional —
        // only sent when the product has a configured flow; hidden-field
        // answers are already pruned by CustomFormStep before reaching here.
        // Server prunes again for defence-in-depth (landr-9ut4 lesson).
        ...(formResponses && formResponses.length > 0
          ? { form_responses: formResponses }
          : {}),
      }
      // landr-aoak.2 [S3].3/.6: parse the optional operator price-override and
      // route the whole body through the SINGLE staff adapter. With no staff
      // session augmentStaffSubmit returns `body` unchanged (byte-identical).
      let priceOverride: PriceOverride | null = null
      if (canOverridePrice && overrideAmount.trim() !== '') {
        const grossTotal = Number(overrideAmount)
        if (!Number.isFinite(grossTotal) || grossTotal < 0) {
          setServerError('Override price must be a non-negative number.')
          setSubmitting(false)
          return
        }
        if (overrideReason.trim() === '') {
          setServerError('Please give a reason for the price override.')
          setSubmitting(false)
          return
        }
        priceOverride = { grossTotal, reason: overrideReason.trim() }
      }
      const submitBody = augmentStaffSubmit(body, {
        session: staff,
        forced,
        priceOverride,
      })
      // landr-aoak.4: a staff submit goes to the SEPARATE operator-scoped staff
      // endpoint (POST /api/staff/operators/{operator_id}/bookings/submit) where
      // the signed staff_session unlocks the operator powers. The public
      // endpoint silently drops force-book / price-override, so routing a staff
      // body there was a no-op of the whole feature. A non-staff body stays on
      // the public path, byte-identically to before.
      let result: SubmitBookingResponse
      if (isStaffSubmitBody(submitBody)) {
        if (!staff.operatorId) {
          // The staff endpoint is operator-path-scoped; without the operator id
          // we cannot route it. Fail loudly rather than silently downgrading to
          // the public path (which would drop the operator powers).
          setServerError(
            'Could not determine the operator for this staff booking. Reopen the booking modal and try again.',
          )
          setSubmitting(false)
          return
        }
        result = await submitStaffBooking(staff.operatorId, submitBody)
      } else {
        // landr-7zc5.3: pass preview_token so the API can accept draft
        // products during operator preview. The option is harmlessly
        // ignored when previewToken is undefined (normal customer flow).
        result = await submitBooking(
          submitBody,
          previewToken ? { previewToken } : undefined,
        )
      }
      // landr-aoak.2 [S3].5: notify the embedding dashboard parent so it can
      // refetch + open the new booking. Only fires in staff mode (active
      // session); a normal customer embed never posts to its parent.
      if (staff.active && typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          { type: 'landr:booking-created', booking_id: result.booking_id },
          resolveParentTargetOrigin(),
        )
      }
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
            className="mt-2 rounded-lg border bg-surface-well px-3 py-2 text-sm shadow-well"
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
        {/* Booker summary — pulled from DetailsStep upstream.
            landr-3mo4: review sections are raised sub-cards so each block of
            the summary reads as a discrete, scannable card. */}
        <section
          data-testid="review-booker"
          className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
        >
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
        <section
          data-testid="review-participants"
          className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
        >
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

        {/* landr-87n9.3 / landr-wv0m: non-guiding companions summary. Rendered
            only when the customer added someone in the "Others joining" section.
            companion_kind distinguishes a non-participating guest from a
            self-paying activity participant (separate_guiding). */}
        {companions.length > 0 ? (
          <section
            data-testid="review-companions"
            className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
          >
            <h3 className="mb-2 text-sm font-semibold">
              Others joining ({companions.length})
            </h3>
            <ol className="space-y-1 text-sm">
              {companions.map((c, idx) => (
                <li
                  key={`companion-${idx}`}
                  className="flex items-baseline justify-between gap-2 border-b py-1 last:border-b-0"
                >
                  <span>
                    <span className="font-medium">
                      {idx + 1}. {c.first_name} {c.last_name}
                    </span>
                    {c.companion_kind === 'separate_guiding' ? (
                      <span
                        className="ml-2 text-xs text-primary font-medium"
                        data-testid={`companion-kind-label-${idx}`}
                      >
                        joining the activity (separate guiding)
                      </span>
                    ) : (
                      <span
                        className="ml-2 text-xs text-muted-foreground"
                        data-testid={`companion-kind-label-${idx}`}
                      >
                        not doing the activity
                      </span>
                    )}
                    {c.email ? (
                      <span className="ml-2 text-xs text-muted-foreground break-all">
                        {c.email}
                      </span>
                    ) : null}
                    {c.phone ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.phone}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* landr-gb2f.4 / gb2f.5: per-room breakfast summary. Shown when the
            customer booked rooms in package mode with add-ons (typically
            breakfast). Lists each room unit with its breakfast status and,
            when a room assignment is present, the occupants so the booker
            can confirm the pairing ("Single Room 1 — with breakfast · Ada,
            Grace"). Placed here (after the party roster, before Confirm) so
            it reads naturally alongside the participant list. */}
        {perRoomBreakfastRows.length > 0 ? (
          <section
            data-testid="review-per-room-breakfast"
            className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
          >
            <h3 className="mb-2 text-sm font-semibold">Room breakfast</h3>
            <ol className="space-y-1 text-sm">
              {perRoomBreakfastRows.map((row, idx) => (
                <li
                  key={`room-unit-${idx}`}
                  className="border-b py-1 last:border-b-0"
                >
                  {/* Room label + room-level breakfast state */}
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{row.label}</span>
                    <span
                      className={[
                        'text-xs font-medium',
                        row.hasBreakfastMapData
                          ? row.breakfastState === 'all'
                            ? 'text-primary'
                            : row.breakfastState === 'some'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          : row.hasBreakfast
                            ? 'text-primary'
                            : 'text-muted-foreground',
                      ].join(' ')}
                      data-testid={`room-breakfast-status-${idx}`}
                    >
                      {row.hasBreakfastMapData
                        ? row.breakfastState === 'all'
                          ? '· breakfast included'
                          : row.breakfastState === 'some'
                            ? '· breakfast for some guests only'
                            : '· no breakfast'
                        : row.hasBreakfast
                          ? 'with breakfast'
                          : 'without breakfast'}
                    </span>
                    {/* Legacy path: show plain occupant names when no per-occupant data */}
                    {!row.hasBreakfastMapData && row.occupantNames.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        · {row.occupantNames.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  {/* landr-rjvd: per-occupant breakfast flags when map data is present */}
                  {row.hasBreakfastMapData && row.occupants.length > 0 ? (
                    <ul className="ml-3 mt-0.5 space-y-0.5">
                      {row.occupants.map((occupant, oIdx) => (
                        <li
                          key={`occupant-${idx}-${oIdx}`}
                          className="flex items-baseline gap-1.5 text-xs text-muted-foreground"
                          data-testid={`room-occupant-breakfast-${idx}-${oIdx}`}
                        >
                          <span>{occupant.name}</span>
                          <span
                            className={
                              occupant.hasBreakfast ? 'text-primary' : 'text-muted-foreground'
                            }
                          >
                            {occupant.hasBreakfast ? '· with breakfast' : '· no breakfast'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* landr-aoak.2 [S3]: force-book summary — shown only when the operator
            (staff mode) pushed this booking past capacity. Makes the override
            explicit on the review screen before Confirm. */}
        {forced ? (
          <section
            data-testid="review-forced"
            className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm dark:border-amber-600 dark:bg-amber-950/40"
          >
            <div className="mb-1 flex items-center gap-2">
              <OperatorOverrideBadge />
            </div>
            <p className="text-amber-900 dark:text-amber-100">
              {forcedDays.length > 0
                ? `${forcedDays.length} day${forcedDays.length === 1 ? '' : 's'} booked past capacity.`
                : 'This window was booked past capacity.'}{' '}
              Capacity will be exceeded for this booking.
            </p>
          </section>
        ) : null}

        {/* landr-aoak.2 [S3].3: operator price-override (staff mode only).
            Sets override_gross_total + override_reason via the submit adapter.
            Hidden entirely for normal customers. */}
        {canOverridePrice ? (
          <section
            data-testid="staff-price-override"
            className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
          >
            <h3 className="mb-2 text-sm font-semibold">Override price (operator)</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Leave blank to use the calculated total. When set, this gross total
              replaces the computed price for this booking.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="override-amount">New gross total</Label>
                <Input
                  id="override-amount"
                  data-testid="override-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 250.00"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="override-reason">Reason</Label>
                <Input
                  id="override-reason"
                  data-testid="override-reason"
                  type="text"
                  placeholder="Reason for the override (required when set)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>
          </section>
        ) : null}

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
