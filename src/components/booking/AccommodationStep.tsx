import { useEffect, useMemo, useState } from 'react'
import {
  getHotelRoomsForHotel,
  getHotelsForOperator,
  getProductAddons,
} from '@/api/client'
import type { Hotel, Product, ProductAddon } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'
import {
  autoAssignParticipants,
  deriveStayWindow,
  expandRoomUnits,
  flattenPerRoomAddons,
  formatCurrency,
  isPremiumIncludesBreakfast,
  pruneAssignments,
  roomSubtotal,
  totalRoomCapacity,
  type RoomAssignmentMap,
  type RoomSelection,
  type RoomUnit,
} from './accommodationCalc'
import { AddonsList } from './AddonsList'
import { RoomAssignment } from './RoomAssignment'
import {
  requiredAddonError,
  type AddonSelection,
} from './addonsState'
import { formatDayLabel } from './dateLabel'
import { StepBackButton } from './StepBackButton'

/**
 * landr-ffyg.2: top-level accommodation MODE. Replaces the old
 * `showSharedDoubleCheckbox` informational-checkbox model (landr-sbhz.4)
 * with a proper mode choice that matches Para42's real booking form:
 *
 *   - 'guiding-only'  — guiding only, the pilot brings their own
 *     accommodation. ONLY offered when product.hotel_offering ===
 *     'optional' (this is the existing "No hotel" opt-out path: rooms=[],
 *     hotelLocationId=null → falls through to the free-pickup picker /
 *     fill-form). Never offered for 'mandatory' (a hotel stay is required).
 *   - 'package'       — book accommodation as a package: the existing
 *     hotel + room-selection flow.
 *   - 'shared-double' — "I am the second pilot in a shared double room".
 *     The pilot books NO room (the first pilot's double room covers both
 *     of them) and is collected from the hotel. We set hotelLocationId so
 *     the landr-4r80 routing makes the hotel the pickup and SKIPS the
 *     free-pickup picker, rooms=[], isSharedDouble=true. The customer must
 *     NEVER reach the free-pickup picker in this mode.
 */
export type AccommodationMode = 'guiding-only' | 'package' | 'shared-double'

interface Props {
  product: Product
  selectedDays: string[]
  operatorToken: string
  /**
   * Number of people travelling, threaded through from ParticipantsStep
   * (landr-mbge). Used by the overbook warning (landr-qpab) to compare
   * against total room capacity and total breakfast quantity. Defaults
   * to 1 when not provided so legacy call sites keep working without
   * triggering false-positive warnings.
   */
  participantCount?: number
  /**
   * landr-gb2f.2: participant display names (first names), indexed by
   * participant index, threaded from DetailsStep. Drives the draggable
   * NAME chips in the room-assignment UI (package mode). Defaults to an
   * empty array — when empty the assignment UI falls back to "Guest N"
   * labels so the chips still render for legacy call sites.
   */
  participantNames?: string[]
  /**
   * Called when the customer confirms a room selection. rooms can be
   * empty when the customer opts out of an `optional` accommodation
   * (guiding-only mode) or chose the shared-double bypass.
   * hotelLocationId is null in the guiding-only case so the booking
   * submit does not pass a hotel context; non-null for both 'package'
   * (chosen hotel + rooms) and 'shared-double' (chosen hotel, NO rooms)
   * so the landr-4r80 routing makes the hotel the pickup.
   *
   * landr-yf0n: the includeHotel boolean reports whether a hotel context
   * is in play at confirm time so App.tsx can stash it in the step state
   * for back-nav restoration. undefined for the mandatory path; false
   * only in guiding-only mode.
   *
   * landr-ffyg.2: isSharedDouble is true when the customer chose the
   * "I am the second pilot in a shared double room" mode. On submit this
   * becomes the top-level `is_shared_double` boolean (landr-ffyg.1) and
   * NO hotel_room product lines are sent — only the guiding service line.
   */
  onConfirm: (
    rooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[],
    includeHotel?: boolean,
    isSharedDouble?: boolean,
    // landr-gb2f.2: participant → room assignment map (participantIndex →
    // {roomProductId, unitIndex}). Empty in guiding-only / shared-double
    // modes (no room units). Threaded into BookingForm so each participant
    // carries its assigned room_product_id + room_unit_index on submit.
    roomAssignment?: RoomAssignmentMap,
  ) => void
  /**
   * Called when the customer wants to go back to the previous step
   * (date selection). Mirrors the other booking steps' Back affordance.
   */
  onBack: () => void
  /**
   * landr-yf0n: when the customer hits Back from a downstream step,
   * App.tsx threads the previously confirmed accommodation context back
   * so the step re-mounts with the prior hotel + rooms + add-ons
   * restored (instead of empty steppers). Each field is independently
   * optional — only what was confirmed comes back.
   *
   * initialIncludeHotel covers the guiding-only-mode opt-out so a
   * customer who opted-out doesn't see the mode flip back on re-entry.
   * undefined → default to the offering-driven initial mode.
   *
   * landr-ffyg.2: initialMode restores the chosen top-level accommodation
   * mode on back-nav re-entry. undefined → default to the offering-driven
   * initial mode ('package' is the default for both mandatory and
   * optional offerings; the customer explicitly opts into guiding-only or
   * shared-double).
   */
  initialHotelLocationId?: string | null
  initialRooms?: RoomSelection[]
  initialAddons?: AddonSelection[]
  initialIncludeHotel?: boolean
  /** landr-ffyg.2: restore the chosen accommodation mode on back-nav re-entry. */
  initialMode?: AccommodationMode
  /**
   * landr-gb2f.2: restore the participant → room assignment on back-nav
   * re-entry so the chips/units re-render with the customer's prior layout
   * instead of re-running a fresh auto-assign. undefined → seed via
   * auto-assign once rooms resolve.
   */
  initialAssignment?: RoomAssignmentMap
}

/**
 * AccommodationStep — between details and pick-pickup/fill-form for
 * service products whose hotel_offering != 'none' (landr-vyaz).
 *
 * landr-ffyg.2: the step now opens with a top-level MODE choice (when at
 * least one hotel is configured). The modes replace the old optional
 * Yes/No hotel toggle AND the informational shared-double checkbox:
 *
 *   - 'guiding-only' (optional offering only): no hotel context — rooms=[],
 *     hotelLocationId=null → free pickup / fill-form.
 *   - 'package': pick a hotel (auto-selected when only one exists), then
 *     pick at least one room.
 *   - 'shared-double': pick a hotel only (auto-selected when only one
 *     exists), NO room steppers, NO free pickup — the hotel is the pickup.
 *
 * landr-ffyg.2 / landr-sbhz.4 history:
 *   - the previous build modelled "second occupant" as an informational
 *     checkbox under a qty=1 double room (`showSharedDoubleCheckbox`).
 *     That checkbox was NOT submitted and still shipped a double-room
 *     line. It is REMOVED here in favour of the proper top-level mode +
 *     the persisted `is_shared_double` boolean (landr-ffyg.1).
 *   - "Hotel is paid directly at check-in (cash / card) — not
 *     included in your booking total." notice, shown inside the package
 *     mode alongside the stay-window orientation line.
 *   - Breakfast add-ons are surfaced via AddonsList per room. Premium
 *     rooms (name includes "with Breakfast") are identified by
 *     isPremiumIncludesBreakfast() and their add-on list is hidden.
 *
 * Pricing: the per-night room price is shown for clarity and totals
 * are summed, but the panel makes it explicit that the hotel is paid
 * directly at check-in and is NOT part of the booking gross_total.
 */
export function AccommodationStep({
  product,
  selectedDays,
  operatorToken,
  participantCount = 1,
  participantNames = [],
  onConfirm,
  onBack,
  initialHotelLocationId,
  initialRooms,
  initialAddons,
  initialIncludeHotel,
  initialMode,
  initialAssignment,
}: Props) {
  const locale = browserLocale()
  const offering = product.hotel_offering ?? 'none'
  const isMandatory = offering === 'mandatory'

  const [hotels, setHotels] = useState<Hotel[] | null>(null)
  const [hotelError, setHotelError] = useState<string | null>(null)
  // landr-yf0n: seed selectedHotelId / selection / addonSelection from the
  // initial-* props so back-nav re-entry restores the prior accommodation
  // state instead of resetting.
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    initialHotelLocationId ?? null,
  )
  // landr-ffyg.2: the top-level accommodation mode. Seeded from initialMode
  // on back-nav re-entry; otherwise inferred from initialIncludeHotel
  // (false → the customer previously opted into guiding-only) and finally
  // defaults to 'package' (the customer must explicitly opt into
  // guiding-only or shared-double). 'guiding-only' is only valid for
  // optional offerings — a mandatory offering can never opt out of a hotel.
  const [mode, setMode] = useState<AccommodationMode>(() => {
    if (initialMode) {
      // Guard: a stale 'guiding-only' on a mandatory product is invalid.
      if (initialMode === 'guiding-only' && isMandatory) return 'package'
      return initialMode
    }
    if (offering === 'optional' && initialIncludeHotel === false) {
      return 'guiding-only'
    }
    return 'package'
  })
  const [rooms, setRooms] = useState<Product[] | null>(null)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    if (!initialRooms || initialRooms.length === 0) return {}
    const seed: Record<string, number> = {}
    for (const r of initialRooms) seed[r.productId] = r.quantity
    return seed
  })
  // Per-room add-on catalogues, keyed by room product_id. Lazily fetched
  // as the room list resolves (one fetch per room). The widget tolerates
  // an individual fetch failure silently — the room itself still
  // bookable; the add-on row simply doesn't render.
  const [addonsByRoom, setAddonsByRoom] = useState<
    Record<string, ProductAddon[]>
  >({})
  // Per-room add-on selection: roomProductId → { addon_product_id → qty }.
  // landr-yybu: each room holds its own independent add-on map so that the
  // same add-on linked to multiple rooms (e.g. Para42 Breakfast on Single +
  // Double) can be ordered independently per room, and the per-room
  // over/under warning compares against THAT room's occupancy.
  //
  // Back-nav seeding (landr-yf0n): initialAddons is still a flat
  // AddonSelection[] (the onConfirm contract is unchanged). On re-entry we
  // assign each add-on's qty to the FIRST room in the current catalogue that
  // links it. This is best-effort — a full per-room restore would require the
  // submit payload to carry per-room breakdown, which is out of scope here.
  // Documented as a known limitation.
  const [addonSelection, setAddonSelection] = useState<
    Record<string, Record<string, number>>
  >({})

  // landr-gb2f.2: participant → room assignment. participantIndex →
  // {roomProductId, unitIndex}. Seeded from initialAssignment on back-nav
  // re-entry; otherwise auto-assigned by the effect below once rooms +
  // selection resolve. The map is the source of truth for the chips/units
  // and is what flows out through onConfirm.
  const [assignment, setAssignment] = useState<RoomAssignmentMap>(
    () => initialAssignment ?? {},
  )

  // landr-ffyg.2: derived mode predicates. A hotel context is needed for
  // both 'package' (rooms) and 'shared-double' (hotel-only pickup); only
  // 'guiding-only' skips the hotel entirely.
  const needsHotel = mode === 'package' || mode === 'shared-double'

  // Fetch hotels for the operator. We always do this on mount so the
  // mode choice can immediately offer the hotel-bearing modes without a
  // second loading state once the customer picks a mode.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getHotelsForOperator(operatorToken)
        if (cancelled) return
        setHotels(list)
      } catch (err) {
        if (cancelled) return
        setHotelError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorToken])

  // landr-punc / landr-ffyg.2: auto-select the lone hotel whenever a
  // hotel-bearing mode is active and exactly one hotel is configured.
  // Covers the mandatory-default, the package mode, and the shared-double
  // mode uniformly. The set lives inside an async IIFE (no synchronous
  // setState in effect body — see widget-eslint-react-hooks-rules memory).
  // Idempotent: re-firing with the same id is a no-op (selectedHotelId
  // guard short-circuits). Guards against clobbering an explicit user pick
  // in the multi-hotel path by gating on the exact-one-hotel condition.
  useEffect(() => {
    if (!needsHotel) return
    if (!hotels || hotels.length !== 1) return
    if (selectedHotelId) return
    let cancelled = false
    void (async () => {
      if (cancelled) return
      const only = hotels[0]
      if (only) setSelectedHotelId(only.location_id)
    })()
    return () => {
      cancelled = true
    }
  }, [needsHotel, hotels, selectedHotelId])

  // Fetch rooms when a hotel is selected AND we're in package mode. The
  // shared-double mode never renders room steppers, so we skip the room
  // fetch entirely there. The previous-state cleanup (rooms→null +
  // selection→{}) happens in the hotel-change handlers rather than
  // synchronously inside the effect — see react-hooks/set-state-in-effect.
  useEffect(() => {
    if (mode !== 'package') return
    if (!selectedHotelId) return
    let cancelled = false
    void (async () => {
      try {
        const list = await getHotelRoomsForHotel(operatorToken, selectedHotelId)
        if (cancelled) return
        setRooms(list)
      } catch (err) {
        if (cancelled) return
        setRoomsError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorToken, selectedHotelId, mode])

  // Fetch add-ons per room as soon as the rooms list resolves. Done as
  // an N-fetch (one per room) rather than a single bulk call because
  // the public RPC is keyed on a single parent product_id; the room
  // catalogue per hotel is tiny in practice (≤ ~5 rows) so the cost is
  // negligible. Per-room failures are swallowed — the room remains
  // bookable, just without its add-on row.
  useEffect(() => {
    if (!rooms || rooms.length === 0) return
    let cancelled = false
    void (async () => {
      const next: Record<string, ProductAddon[]> = {}
      await Promise.all(
        rooms.map(async (room) => {
          try {
            next[room.product_id] = await getProductAddons(room.product_id)
          } catch {
            next[room.product_id] = []
          }
        }),
      )
      if (cancelled) return
      setAddonsByRoom(next)
    })()
    return () => {
      cancelled = true
    }
  }, [rooms])

  // landr-yybu / landr-yf0n: back-nav add-on seeding. Once the per-room
  // catalogue resolves AND initialAddons has entries, assign each add-on
  // qty to the first room that links it (best-effort; documented limitation).
  // We only seed ONCE (when addonSelection is still empty) to avoid
  // clobbering changes the customer makes after re-entering the step.
  // The IIFE pattern avoids the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (!initialAddons || initialAddons.length === 0) return
    if (Object.keys(addonsByRoom).length === 0) return
    // Only seed when addonSelection is still empty (no customer edits yet).
    if (Object.keys(addonSelection).length > 0) return
    let cancelled = false
    void (async () => {
      if (cancelled) return
      const next: Record<string, Record<string, number>> = {}
      for (const line of initialAddons) {
        if (line.quantity <= 0) continue
        // Find the first room that has this add-on in its catalogue.
        for (const [roomId, roomAddons] of Object.entries(addonsByRoom)) {
          const found = roomAddons.some(
            (a) => a.addon_product_id === line.productId,
          )
          if (found) {
            next[roomId] = { ...(next[roomId] ?? {}), [line.productId]: line.quantity }
            break
          }
        }
      }
      if (cancelled) return
      if (Object.keys(next).length > 0) setAddonSelection(next)
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonsByRoom])
  // ^ intentionally excludes `initialAddons` and `addonSelection` from
  //   dependencies: initialAddons is a prop that never changes after mount;
  //   addonSelection is the output being written (not a trigger); the
  //   effect must re-run only when the catalogue arrives.

  // Centralised hotel-change handler — resets the room list + selected
  // quantities BEFORE the next render so the effect only handles the
  // async fetch. Used by the radio onChange in package + shared-double
  // modes. Also clears add-on selections so a customer switching hotels
  // doesn't carry over breakfasts from the previous hotel's room list.
  function changeHotel(nextId: string | null) {
    setSelectedHotelId(nextId)
    setRooms(null)
    setRoomsError(null)
    setSelection({})
    setAddonsByRoom({})
    setAddonSelection({})
    // landr-gb2f.2: a new hotel means a new room list — drop the prior
    // participant→room assignment so it doesn't reference stale units.
    setAssignment({})
  }

  // landr-ffyg.2: switching mode resets the room/add-on context so a stale
  // selection from one mode doesn't bleed into another (e.g. picking rooms
  // in package mode then flipping to shared-double must clear the rooms).
  // The chosen hotel is preserved across package <-> shared-double switches
  // (both need a hotel); only guiding-only clears it.
  function changeMode(next: AccommodationMode) {
    setMode(next)
    setRooms(null)
    setRoomsError(null)
    setSelection({})
    setAddonsByRoom({})
    setAddonSelection({})
    // landr-gb2f.2: only package mode has room units — clear the assignment
    // when switching modes so a stale package-mode layout doesn't bleed in.
    setAssignment({})
    if (next === 'guiding-only') {
      // Guiding-only has no hotel context at all.
      setSelectedHotelId(null)
    }
  }

  const { checkInIso, checkOutIso, nights } = useMemo(
    () => deriveStayWindow(selectedDays),
    [selectedDays],
  )

  const roomSelections: RoomSelection[] = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [selection],
  )

  // landr-gb2f.2: expand picked rooms into per-unit slots (a qty=2 double
  // → 2 units). Only meaningful in package mode; empty elsewhere. Depends
  // on the resolved room catalogue for capacity_per_unit + display names,
  // so it's empty until `rooms` loads.
  const roomUnits: RoomUnit[] = useMemo(
    () => (mode === 'package' ? expandRoomUnits(roomSelections, rooms ?? []) : []),
    [mode, roomSelections, rooms],
  )

  // landr-gb2f.2: re-run auto-assign whenever the set of units changes
  // (room added/removed/qty bumped). The pure helper never clobbers an
  // existing manual assignment and prunes references to units that no
  // longer exist; participants without a slot are left unassigned (a
  // leftover chip). The IIFE-in-effect pattern keeps the
  // react-hooks/set-state-in-effect lint rule happy (no synchronous
  // setState in the effect body). Keyed on a stable signature of the unit
  // set so it doesn't re-fire on unrelated re-renders.
  const unitSignature = roomUnits
    .map((u) => `${u.roomProductId}:${u.unitIndex}:${u.capacity}`)
    .join('|')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      setAssignment((prev) =>
        autoAssignParticipants(roomUnits, participantCount, prev),
      )
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitSignature, participantCount])
  // ^ keyed on unitSignature (a stable string) + participantCount rather
  //   than the roomUnits array identity (which changes every render). The
  //   setAssignment functional update reads the latest map, so roomUnits/
  //   participantCount are the only real triggers.

  const productName = pickLocalized(product.name, product.name_localized, locale)
  const totalRoomsPicked = roomSelections.reduce((acc, r) => acc + r.quantity, 0)

  // Overbook warning inputs (landr-qpab) — both are non-blocking; the
  // customer can still hit Continue with the warning visible. We compute
  // capacity vs participants and breakfast vs participants from the same
  // selection state already driving the steppers + add-ons. Only relevant
  // in package mode (the other modes have no room steppers).
  const totalCapacity = useMemo(
    () => totalRoomCapacity(roomSelections, rooms ?? []),
    [roomSelections, rooms],
  )

  // Warning visibility — capacity gate requires package mode + at least one
  // room picked so an empty cart doesn't surface a "0 beds for N people"
  // copy on mount. landr-yybu: the bottom aggregate breakfast warning is
  // removed; per-room over/under warnings in AddonsList replace it.
  const showCapacityWarning =
    mode === 'package' && totalRoomsPicked > 0 && totalCapacity < participantCount

  // Required add-ons gate Continue regardless of room selection — if a
  // room with a required breakfast is in the cart and the breakfast qty
  // is 0, the customer must address it before proceeding. Walk every
  // picked room's add-on catalogue and surface the first unmet required
  // row; the AddonsList itself renders the per-row helper line.
  // landr-yybu: addonSelection is now per-room, so look up
  // (addonSelection[roomId] ?? {})[addon_product_id].
  const unmetRequiredAddon = useMemo(() => {
    if (mode !== 'package' || totalRoomsPicked === 0) return false
    for (const [roomId] of Object.entries(selection)) {
      const list = addonsByRoom[roomId] ?? []
      const roomAddonQtys = addonSelection[roomId] ?? {}
      for (const addon of list) {
        const qty = roomAddonQtys[addon.addon_product_id] ?? 0
        if (requiredAddonError(addon, qty) !== null) return true
      }
    }
    return false
  }, [mode, totalRoomsPicked, selection, addonsByRoom, addonSelection])

  // Continue enablement per mode:
  //   guiding-only → always (no further input needed).
  //   shared-double → a hotel must be chosen (auto when 1; radio when >1).
  //   package → hotel + ≥1 room + all required add-ons met.
  const canContinue =
    mode === 'guiding-only'
      ? true
      : mode === 'shared-double'
        ? Boolean(selectedHotelId)
        : Boolean(selectedHotelId) &&
          totalRoomsPicked > 0 &&
          !unmetRequiredAddon

  function bumpQty(productId: string, delta: number) {
    setSelection((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta)
      const out = { ...prev, [productId]: next }
      if (next === 0) delete out[productId]
      return out
    })
  }

  // landr-gb2f.2: manual (re)assignment from RoomAssignment. target=null
  // unassigns. We honour the unit capacity here so a manual drop onto a
  // full unit is a no-op (the chip stays put) — the only place capacity is
  // enforced as a hard cap; auto-assign already respects it. Assigning a
  // participant who was elsewhere moves them (single-unit membership).
  function assignParticipant(participantIndex: number, target: RoomUnit | null) {
    setAssignment((prev) => {
      const next = { ...prev }
      if (target === null) {
        delete next[participantIndex]
        return next
      }
      // Count current occupants of the target unit, excluding the mover.
      let occupants = 0
      for (const [pid, entry] of Object.entries(next)) {
        if (Number(pid) === participantIndex) continue
        if (
          entry.roomProductId === target.roomProductId &&
          entry.unitIndex === target.unitIndex
        ) {
          occupants += 1
        }
      }
      if (occupants >= target.capacity) return prev // full — reject the drop
      next[participantIndex] = {
        roomProductId: target.roomProductId,
        unitIndex: target.unitIndex,
      }
      return next
    })
  }

  function handleContinue() {
    // landr-ffyg.2: guiding-only — no hotel context. Report
    // includeHotel=false so App.tsx stashes the opt-out for back-nav.
    if (mode === 'guiding-only') {
      onConfirm([], null, [], false, false, {})
      return
    }
    if (!selectedHotelId) return
    // landr-ffyg.2: shared-double — the chosen hotel IS the pickup, NO
    // room lines, NO add-ons. The landr-4r80 routing sees a non-null
    // hotelLocationId and skips the free-pickup picker straight to
    // declarations/fill-form. includeHotel reports the offering-driven
    // gate: for optional offerings the hotel context IS present so we
    // report true; for mandatory it's undefined (the gate doesn't apply).
    if (mode === 'shared-double') {
      onConfirm(
        [],
        selectedHotelId,
        [],
        offering === 'optional' ? true : undefined,
        true,
        {},
      )
      return
    }
    // package mode — rooms required.
    if (roomSelections.length === 0) return
    // landr-yybu: flatten the per-room add-on map back to AddonSelection[].
    // Sum qty per addon_product_id across rooms, only for rooms still in the
    // cart and only for add-ons in those rooms' catalogues (guards against
    // carry-over from a dropped room). flattenPerRoomAddons handles this.
    const addonLines = flattenPerRoomAddons(addonSelection, selection, addonsByRoom)
    // landr-gb2f.2: prune the assignment to the units actually present at
    // confirm time (guards against a dangling reference if a room was just
    // dropped between the last auto-assign and Continue).
    const finalAssignment = pruneAssignments(assignment, roomUnits)
    onConfirm(
      roomSelections,
      selectedHotelId,
      addonLines,
      offering === 'optional' ? true : undefined,
      false,
      finalAssignment,
    )
  }

  // landr-ffyg.2: the mode options shown to the customer. 'guiding-only'
  // is ONLY offered for an optional offering. 'package' + 'shared-double'
  // are always offered (a hotel-bearing offering always supports them).
  const modeOptions: { value: AccommodationMode; label: string; hint: string }[] =
    [
      ...(offering === 'optional'
        ? [
            {
              value: 'guiding-only' as const,
              label: 'Guiding only — I bring my own accommodation',
              hint: 'No hotel booked through us — straight to pickup.',
            },
          ]
        : []),
      {
        value: 'package' as const,
        label: 'Book accommodation (package)',
        hint: 'Pick a hotel and rooms for your stay.',
      },
      {
        value: 'shared-double' as const,
        label: 'I am the second pilot in a shared double room',
        hint: 'No room booked — another pilot holds the double room. You are collected from the hotel.',
      },
    ]

  // The hotel context is shown for package + shared-double modes once a
  // hotel exists. Auto-select banner when exactly one hotel; radio list
  // when multiple.
  const showHotelContext = needsHotel && hotels && hotels.length > 0

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Accommodation</CardTitle>
        <CardDescription>
          {productName} ·{' '}
          {offering === 'mandatory'
            ? 'Hotel stay required'
            : 'Add a hotel stay (optional)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* landr-ffyg.2: top-level accommodation mode choice. Shown only
            when at least one hotel is configured — without a hotel the
            modes collapse (no package, no shared-double) and we fall back
            to the "no hotels configured" notice below. */}
        {hotels && hotels.length > 0 ? (
          <fieldset
            className="flex flex-col gap-2"
            data-testid="accommodation-mode"
          >
            <legend className="text-sm font-medium">
              How would you like to handle accommodation?
            </legend>
            {modeOptions.map((opt) => {
              const checked = mode === opt.value
              return (
                <label
                  key={opt.value}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                    checked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  ].join(' ')}
                  data-testid={`accommodation-mode-${opt.value}`}
                >
                  <input
                    type="radio"
                    name="accommodation-mode"
                    value={opt.value}
                    checked={checked}
                    onChange={() => changeMode(opt.value)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>
        ) : null}

        {/* Hotel picker — package + shared-double modes. Hidden when only
            one hotel exists (auto-selected via the effect above). */}
        {showHotelContext ? (
          hotels.length === 1 ? (
            <p className="text-sm text-muted-foreground">
              Staying at{' '}
              <span className="font-medium text-foreground">
                {pickLocalized(hotels[0]!.name, hotels[0]!.name_localized, locale)}
              </span>
              .
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Choose your hotel</legend>
              {hotels.map((hotel) => {
                const checked = selectedHotelId === hotel.location_id
                const name = pickLocalized(hotel.name, hotel.name_localized, locale)
                return (
                  <label
                    key={hotel.location_id}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors',
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="hotel"
                      value={hotel.location_id}
                      checked={checked}
                      onChange={() => changeHotel(hotel.location_id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </fieldset>
          )
        ) : null}

        {needsHotel && hotels && hotels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotels configured for this operator yet.
          </p>
        ) : null}

        {hotelError ? (
          <p className="text-sm text-destructive">{hotelError}</p>
        ) : null}

        {/* landr-ffyg.2: shared-double explanatory notice. No room steppers
            render in this mode — the first pilot's double room covers both,
            and the hotel is the pickup point. */}
        {mode === 'shared-double' && selectedHotelId ? (
          <p
            className="rounded-md border border-border bg-muted/30 p-3 text-sm"
            data-testid="shared-double-notice"
          >
            You are the second pilot sharing a double room. No room is
            booked through us — the other pilot holds the room — and you
            will be collected from the hotel.
          </p>
        ) : null}

        {/* Room list — package mode only. */}
        {mode === 'package' && selectedHotelId ? (
          <fieldset className="flex flex-col gap-3 border-t pt-3">
            <legend className="text-sm font-medium">Rooms</legend>
            {rooms === null && !roomsError ? (
              <p className="text-sm text-muted-foreground">Loading rooms…</p>
            ) : null}
            {roomsError ? (
              <p className="text-sm text-destructive">{roomsError}</p>
            ) : null}
            {rooms && rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rooms configured for this hotel yet.
              </p>
            ) : null}
            {rooms?.map((room) => {
              const qty = selection[room.product_id] ?? 0
              const roomName = pickLocalized(room.name, room.name_localized, locale)
              const subtotal = roomSubtotal(room, qty, nights)
              const roomAddons = addonsByRoom[room.product_id] ?? []
              // Only show add-on rows once at least one of THIS room is
              // in the cart — otherwise an empty room block sprouts an
              // un-actionable list of add-ons.
              // Premium-with-breakfast rooms already include breakfast in
              // their price; suppress the breakfast add-on row.
              const isPremium = isPremiumIncludesBreakfast(room)
              const showAddons = qty > 0 && roomAddons.length > 0 && !isPremium
              return (
                <div
                  key={room.product_id}
                  className="flex flex-col gap-2 rounded-md border border-border p-3"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{roomName}</span>
                      {room.price_per_unit ? (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(Number(room.price_per_unit), room.currency)}{' '}
                          / night
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Price on request
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={qty <= 0}
                        onClick={() => bumpQty(room.product_id, -1)}
                        aria-label={`Decrease ${roomName} quantity`}
                      >
                        −
                      </Button>
                      <span
                        className="w-6 text-center text-sm tabular-nums"
                        aria-live="polite"
                      >
                        {qty}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => bumpQty(room.product_id, 1)}
                        aria-label={`Increase ${roomName} quantity`}
                      >
                        +
                      </Button>
                      <span className="ml-2 w-20 text-right text-sm tabular-nums text-muted-foreground">
                        {subtotal > 0
                          ? formatCurrency(subtotal, room.currency)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  {showAddons ? (
                    // landr-yybu: each room gets its own slice of addonSelection
                    // keyed by this room's product_id. The setter merges the
                    // updated slice back into the top-level per-room map so
                    // sibling rooms' selections stay independent.
                    <AddonsList
                      addons={roomAddons}
                      selection={addonSelection[room.product_id] ?? {}}
                      onChange={(next) =>
                        setAddonSelection((prev) => ({
                          ...prev,
                          [room.product_id]: next,
                        }))
                      }
                      expectedQty={(room.capacity_per_unit ?? 1) * qty}
                      heading="Add-ons"
                    />
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        ) : null}

        {/* landr-gb2f.2: participant → room assignment. Package mode only,
            shown once at least one room unit exists. Auto-assign has
            already seeded the map; the customer can drag/tap/select to
            adjust. The assignment is purely organisational (non-blocking)
            — Continue does not gate on everyone being assigned. */}
        {mode === 'package' && roomUnits.length > 0 && participantCount > 0 ? (
          <fieldset className="flex flex-col gap-3 border-t pt-3">
            <legend className="text-sm font-medium">Room assignment</legend>
            <RoomAssignment
              units={roomUnits}
              participantNames={
                participantNames.length > 0
                  ? participantNames.slice(0, participantCount)
                  : Array.from({ length: participantCount }, () => '')
              }
              assignment={assignment}
              onAssign={assignParticipant}
            />
          </fieldset>
        ) : null}

        {/*
          Overbook warnings (landr-qpab). Non-blocking — Continue stays
          enabled. Orange tone (amber border + background) matches the
          existing "paid directly" notice below so the visual language
          is consistent across this step.
        */}
        {showCapacityWarning ? (
          <p
            role="alert"
            data-testid="overbook-capacity-warning"
            className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            You have {participantCount}{' '}
            {participantCount === 1 ? 'person' : 'people'} but only{' '}
            {totalCapacity} {totalCapacity === 1 ? 'bed' : 'beds'} — sure?
          </p>
        ) : null}
        {/* landr-yybu: bottom aggregate breakfast warning removed.
            Per-room over/under warnings in AddonsList replace it. */}

        {/* landr-kat8: stripped the inline price + totals breakdown — the
            PriceSidebar's "At-hotel total · pay at check-in" pill now
            owns the canonical hotel summary. We retain a short check-in/out
            stay window for orientation inside the package mode so the
            customer knows which nights the rooms below cover, plus the
            payment notice so it's read alongside the room list. */}
        {mode === 'package' && selectedHotelId && rooms && rooms.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p
              className="text-xs text-muted-foreground"
              data-testid="accommodation-stay-window"
            >
              Stay: {checkInIso ? formatDayLabel(checkInIso, locale) : '—'} →{' '}
              {checkOutIso ? formatDayLabel(checkOutIso, locale) : '—'} ·{' '}
              {nights} {nights === 1 ? 'night' : 'nights'}
            </p>
            <p
              className="text-xs italic text-muted-foreground"
              data-testid="accommodation-payment-notice"
            >
              Hotel is paid directly at check-in (cash / card) — not included
              in your booking total.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button type="button" disabled={!canContinue} onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
