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
  deriveStayWindow,
  findBreakfastAddonIds,
  formatCurrency,
  isPremiumIncludesBreakfast,
  roomSubtotal,
  totalBreakfastQty,
  totalRoomCapacity,
  type RoomSelection,
} from './accommodationCalc'
import { AddonsList } from './AddonsList'
import {
  requiredAddonError,
  type AddonSelection,
} from './addonsState'
import { formatDayLabel } from './dateLabel'
import { StepBackButton } from './StepBackButton'

interface Props {
  product: Product
  selectedDays: string[]
  operatorSlug: string
  /**
   * Number of people travelling, threaded through from ParticipantsStep
   * (landr-mbge). Used by the overbook warning (landr-qpab) to compare
   * against total room capacity and total breakfast quantity. Defaults
   * to 1 when not provided so legacy call sites keep working without
   * triggering false-positive warnings.
   */
  participantCount?: number
  /**
   * Called when the customer confirms a room selection. rooms can be
   * empty when the customer opts out of an `optional` accommodation.
   * hotelLocationId is null in that case so the booking submit does
   * not pass a hotel context.
   *
   * landr-yf0n: the includeHotel boolean reports the optional-mode
   * Yes/No state at confirm time so App.tsx can stash it in the step
   * state for back-nav restoration. undefined for the mandatory path.
   *
   * landr-sbhz.4: isSharedDouble is true when the customer checked
   * "I am the second occupant of a shared double room". This is
   * informational only — it does not change the submitted product
   * lines (the double room line still goes through as qty=1 so the
   * hotel knows one room is occupied by two separate bookings). It is
   * threaded through the step machine so back-nav restores the tick.
   */
  onConfirm: (
    rooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[],
    includeHotel?: boolean,
    isSharedDouble?: boolean,
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
   * initialIncludeHotel covers the optional-mode Yes/No gate so a
   * customer who opted-out doesn't see the gate flip back to "Yes" on
   * re-entry. undefined → default to the offering-driven initial value.
   *
   * initialIsSharedDouble restores the shared-double tick (landr-sbhz.4).
   */
  initialHotelLocationId?: string | null
  initialRooms?: RoomSelection[]
  initialAddons?: AddonSelection[]
  initialIncludeHotel?: boolean
  /** landr-sbhz.4: restore shared-double flag on back-nav re-entry. */
  initialIsSharedDouble?: boolean
}

/**
 * AccommodationStep — between pick-selection and pick-pickup/fill-form
 * for service products whose hotel_offering != 'none' (landr-vyaz).
 *
 * Mandatory flow: customer picks a hotel (auto-selected when only one
 * is configured), then picks at least one room. Optional flow: same
 * but a Yes/No toggle gates the hotel + rooms — answering No skips
 * the hotel context entirely.
 *
 * landr-sbhz.4 additions:
 *   - "I am the second occupant of a shared double room" checkbox,
 *     shown when exactly 1 double-capacity room is in the cart. The
 *     checkbox is informational — it doesn't change the booking lines;
 *     the hotel receives one double-room line and knows internally that
 *     two separate bookings share the room. The flag is threaded to
 *     onConfirm so the step machine can restore it on back-nav.
 *   - "Hotel is paid directly at check-in (cash / card) — not
 *     included in your booking total." notice, shown inside the step
 *     alongside the stay-window orientation line so the customer reads
 *     it while looking at the room list (rather than only in the
 *     sidebar pill).
 *   - Breakfast add-ons are already surfaced via AddonsList per room.
 *     Premium rooms (name includes "with Breakfast" / "incl. breakfast")
 *     are identified by isPremiumIncludesBreakfast() and their add-on
 *     list is hidden to avoid suggesting a duplicate breakfast charge.
 *
 * Pricing: the per-night room price is shown for clarity and totals
 * are summed, but the panel makes it explicit that the hotel is paid
 * directly at check-in and is NOT part of the booking gross_total.
 * The pricing engine on the API side still bills the rooms (via the
 * landr-kd5t multiplier) so operators that route hotel revenue
 * through the platform keep that path; the "paid directly" copy is
 * the consumer-facing affordance landr-vyaz scopes to.
 */
export function AccommodationStep({
  product,
  selectedDays,
  operatorSlug,
  participantCount = 1,
  onConfirm,
  onBack,
  initialHotelLocationId,
  initialRooms,
  initialAddons,
  initialIncludeHotel,
  initialIsSharedDouble,
}: Props) {
  const locale = browserLocale()
  const offering = product.hotel_offering ?? 'none'
  const isMandatory = offering === 'mandatory'

  const [hotels, setHotels] = useState<Hotel[] | null>(null)
  const [hotelError, setHotelError] = useState<string | null>(null)
  // landr-yf0n: seed selectedHotelId / includeHotel / selection /
  // addonSelection from the initial-* props so back-nav re-entry
  // restores the prior accommodation state instead of resetting.
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    initialHotelLocationId ?? null,
  )
  const [includeHotel, setIncludeHotel] = useState<boolean>(
    initialIncludeHotel ?? isMandatory,
  )
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
  // Add-on selection map: addon_product_id → quantity. Shared across
  // every room because the same add-on (e.g. Breakfast) can be linked
  // to several rooms and the customer ultimately picks a single total
  // quantity; collapsing into one map keeps the submit payload free of
  // duplicate addon line items.
  // landr-yf0n: seed from initialAddons on back-nav re-entry.
  const [addonSelection, setAddonSelection] = useState<
    Record<string, number>
  >(() => {
    if (!initialAddons || initialAddons.length === 0) return {}
    const seed: Record<string, number> = {}
    for (const line of initialAddons) seed[line.productId] = line.quantity
    return seed
  })

  // landr-sbhz.4: shared-double flag. True when the customer ticked "I
  // am the second occupant of a shared double room". Seeded from
  // initialIsSharedDouble on back-nav re-entry; reset to false when the
  // hotel/room selection changes (changeHotel) because a different room
  // choice may not be a double at all.
  const [isSharedDouble, setIsSharedDouble] = useState<boolean>(
    initialIsSharedDouble ?? false,
  )

  // Fetch hotels for the operator. We always do this on mount so the
  // 'optional' flow can immediately offer the customer a Yes/No choice
  // without a second loading state after they answer Yes.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getHotelsForOperator(operatorSlug)
        if (cancelled) return
        setHotels(list)
        // Auto-select when mandatory + exactly one hotel exists. Skip
        // the hotel-picker UI entirely in that case so the customer
        // sees the room list immediately. The optional + Yes case is
        // handled by a separate effect below so the auto-select fires
        // when the customer flips includeHotel from false → true (the
        // hotel list resolves on mount, before the toggle is clicked).
        if (isMandatory && list.length === 1 && list[0]) {
          setSelectedHotelId(list[0].location_id)
        }
      } catch (err) {
        if (cancelled) return
        setHotelError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorSlug, isMandatory])

  // landr-punc: auto-select the lone hotel in the optional + Yes path.
  // The hotel list resolves on mount (effect above) but the customer
  // hasn't clicked "Yes, add hotel" yet, so we re-run when includeHotel
  // flips. The set lives inside an async IIFE (no synchronous setState
  // in effect body — see widget-eslint-react-hooks-rules memory).
  // Idempotent: re-firing with the same id is a no-op because the
  // selectedHotelId guard short-circuits. Guards against clobbering an
  // explicit user pick in the (offering=optional, hotels.length>1) path
  // by gating on the exact-one-hotel condition.
  useEffect(() => {
    if (!includeHotel) return
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
  }, [includeHotel, hotels, selectedHotelId])

  // Fetch rooms when a hotel is selected. The previous-state cleanup
  // (rooms→null + selection→{}) happens in the hotel-change handlers
  // rather than synchronously inside the effect — see react-hooks/
  // set-state-in-effect. The effect itself only runs the async load.
  useEffect(() => {
    if (!selectedHotelId) return
    let cancelled = false
    void (async () => {
      try {
        const list = await getHotelRoomsForHotel(operatorSlug, selectedHotelId)
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
  }, [operatorSlug, selectedHotelId])

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

  // Centralised hotel-change handler — resets the room list + selected
  // quantities BEFORE the next render so the effect only handles the
  // async fetch. Used by the radio onChange and the "No, thanks"
  // optional opt-out path. Also clears add-on selections so a customer
  // switching hotels doesn't carry over breakfasts from the previous
  // hotel's room list. Resets shared-double flag since a different room
  // selection may not be a double.
  function changeHotel(nextId: string | null) {
    setSelectedHotelId(nextId)
    setRooms(null)
    setRoomsError(null)
    setSelection({})
    setAddonsByRoom({})
    setAddonSelection({})
    setIsSharedDouble(false)
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

  const productName = pickLocalized(product.name, product.name_localized, locale)
  const totalRoomsPicked = roomSelections.reduce((acc, r) => acc + r.quantity, 0)

  // 'optional' + No → no hotel context; confirm immediately on Continue.
  const optedOut = offering === 'optional' && !includeHotel

  // Overbook warning inputs (landr-qpab) — both are non-blocking; the
  // customer can still hit Continue with the warning visible. We compute
  // capacity vs participants and breakfast vs participants from the same
  // selection state already driving the steppers + add-ons.
  const totalCapacity = useMemo(
    () => totalRoomCapacity(roomSelections, rooms ?? []),
    [roomSelections, rooms],
  )

  // Walk every selected room's add-on catalogue once to identify the
  // breakfast addon_product_ids in play, then collapse the picked qtys
  // across them. Same add-on may be linked to multiple rooms (Para42
  // seeds Breakfast on Single + Double) and the customer picks a single
  // total quantity — addonSelection is already keyed by addon_product_id
  // so de-duplication is implicit.
  const breakfastQty = useMemo(() => {
    const breakfastIds = new Set<string>()
    for (const roomId of Object.keys(selection)) {
      for (const id of findBreakfastAddonIds(addonsByRoom[roomId] ?? [])) {
        breakfastIds.add(id)
      }
    }
    return totalBreakfastQty(addonSelection, breakfastIds)
  }, [selection, addonsByRoom, addonSelection])

  // Warning visibility — both gates require at least one room picked so
  // an empty cart doesn't surface a "0 beds for N people" copy on mount.
  const showCapacityWarning =
    !optedOut && totalRoomsPicked > 0 && totalCapacity < participantCount
  const showBreakfastWarning =
    !optedOut && totalRoomsPicked > 0 && breakfastQty > participantCount

  // Required add-ons gate Continue regardless of room selection — if a
  // room with a required breakfast is in the cart and the breakfast qty
  // is 0, the customer must address it before proceeding. Walk every
  // picked room's add-on catalogue and surface the first unmet required
  // row; the AddonsList itself renders the per-row helper line.
  const unmetRequiredAddon = useMemo(() => {
    if (optedOut || totalRoomsPicked === 0) return false
    for (const [roomId] of Object.entries(selection)) {
      const list = addonsByRoom[roomId] ?? []
      for (const addon of list) {
        const qty = addonSelection[addon.addon_product_id] ?? 0
        if (requiredAddonError(addon, qty) !== null) return true
      }
    }
    return false
  }, [optedOut, totalRoomsPicked, selection, addonsByRoom, addonSelection])

  const canContinue = optedOut
    ? true
    : Boolean(selectedHotelId) &&
      totalRoomsPicked > 0 &&
      !unmetRequiredAddon

  function bumpQty(productId: string, delta: number) {
    setSelection((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta)
      const out = { ...prev, [productId]: next }
      if (next === 0) delete out[productId]
      // Reset shared-double when the qty of any room changes — the
      // customer may have switched to a different room type.
      return out
    })
    setIsSharedDouble(false)
  }

  // landr-sbhz.4: determine whether the shared-double checkbox should
  // be visible. Condition: exactly one double-capacity room in the cart
  // (qty=1) and the product is not a premium-includes-breakfast type
  // (those are single-occupancy packages). We detect "double capacity"
  // via capacity_per_unit >= 2 on the room product; if capacity_per_unit
  // is null (legacy), we fall back to a slug/name heuristic.
  const showSharedDoubleCheckbox = useMemo(() => {
    if (!rooms) return false
    // Look for any room product with qty=1 and capacity_per_unit >= 2
    // (or matching the double/doppel heuristic when capacity not set).
    return rooms.some((room) => {
      const qty = selection[room.product_id] ?? 0
      if (qty !== 1) return false
      // Prefer the structured capacity field.
      if (room.capacity_per_unit !== null && room.capacity_per_unit !== undefined) {
        return room.capacity_per_unit >= 2
      }
      // Fallback: name/slug heuristic for legacy rooms without capacity set.
      const combined = `${room.name} ${room.slug ?? ''}`.toLowerCase()
      return combined.includes('double') || combined.includes('doppel')
    })
  }, [rooms, selection])

  function handleContinue() {
    if (optedOut) {
      // landr-yf0n: report includeHotel=false so App.tsx can stash the
      // opt-out state for back-nav restoration.
      onConfirm([], null, [], offering === 'optional' ? false : undefined)
      return
    }
    if (!selectedHotelId || roomSelections.length === 0) return
    // Collapse the add-on selection map into line items (qty > 0 only).
    // Only include add-ons whose parent room is actually in the cart;
    // a customer who picked a Breakfast under "Single Room" and then
    // dropped Single Room to 0 should not ship a Breakfast line.
    const activeAddonIds = new Set<string>()
    for (const [roomId] of Object.entries(selection)) {
      for (const addon of addonsByRoom[roomId] ?? []) {
        activeAddonIds.add(addon.addon_product_id)
      }
    }
    const addonLines: AddonSelection[] = Object.entries(addonSelection)
      .filter(([id, qty]) => qty > 0 && activeAddonIds.has(id))
      .map(([productId, quantity]) => ({ productId, quantity }))
    onConfirm(
      roomSelections,
      selectedHotelId,
      addonLines,
      offering === 'optional' ? includeHotel : undefined,
      isSharedDouble,
    )
  }

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
        {/* Optional-mode Yes/No gate. Mandatory mode skips this. */}
        {offering === 'optional' ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              Would you like to add a hotel stay?
            </legend>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={includeHotel ? 'default' : 'outline'}
                onClick={() => setIncludeHotel(true)}
              >
                Yes, add hotel
              </Button>
              <Button
                type="button"
                variant={!includeHotel ? 'default' : 'outline'}
                onClick={() => {
                  // landr-eiiz: "No, thanks" auto-advances. The bare radio-
                  // toggle UX made the button look unresponsive (it only
                  // mutated local state and waited for a second Continue
                  // click). We now fire the same payload Continue would
                  // fire when opted out — empty rooms + null hotel + empty
                  // add-ons — so the customer skips straight to the next
                  // step. Continue still works as a fallback (e.g. if the
                  // customer toggled Yes→No and the rooms list cleanup
                  // already ran). The single-hotel auto-skip (landr-punc)
                  // is gated on includeHotel so this opt-out doesn't fire
                  // it; the room fetch effect short-circuits on a null
                  // selectedHotelId regardless.
                  setIncludeHotel(false)
                  changeHotel(null)
                  // landr-yf0n: report includeHotel=false for back-nav
                  // restoration.
                  onConfirm([], null, [], false)
                }}
              >
                No, thanks
              </Button>
            </div>
          </fieldset>
        ) : null}

        {/* Hotel picker — hidden when the customer opted out or only one
            hotel exists (auto-selected via the effect above). landr-punc:
            we also auto-skip the picker in the optional + Yes single-hotel
            path so the customer doesn't have to click through a redundant
            one-item radio list before reaching the rooms. */}
        {!optedOut && hotels && hotels.length > 0 ? (
          hotels.length === 1 && (isMandatory || includeHotel) ? (
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

        {!optedOut && hotels && hotels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotels configured for this operator yet.
          </p>
        ) : null}

        {hotelError ? (
          <p className="text-sm text-destructive">{hotelError}</p>
        ) : null}

        {/* Room list for the selected hotel. */}
        {!optedOut && selectedHotelId ? (
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
              // landr-sbhz.4: premium-with-breakfast rooms already include
              // breakfast in their price; suppress the breakfast add-on row
              // to avoid implying a second charge.
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
                    <AddonsList
                      addons={roomAddons}
                      selection={addonSelection}
                      onChange={setAddonSelection}
                      expectedQty={(room.capacity_per_unit ?? 1) * qty}
                      heading="Add-ons"
                    />
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        ) : null}

        {/*
          landr-sbhz.4: Shared-double checkbox. Shown when the customer
          has exactly 1 double-capacity room in their cart. Clicking it
          acknowledges that another pilot holds the second half of the
          same room under a separate booking; they each settle their half
          of the room price directly at check-in.

          The checkbox is informational — it does NOT halve the displayed
          room cost, because the hotel total is paid externally (not
          through LANDR) and the hotel keeps its own record of which
          bookings share a room. The flag is forwarded via onConfirm so
          the step machine can restore it on back-nav.
        */}
        {showSharedDoubleCheckbox ? (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm"
            data-testid="shared-double-checkbox-label"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={isSharedDouble}
              onChange={(e) => setIsSharedDouble(e.target.checked)}
              data-testid="shared-double-checkbox"
            />
            <span>
              I am the second occupant sharing this double room with another
              booking. I will settle my half of the room price directly at
              check-in.
            </span>
          </label>
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
        {showBreakfastWarning ? (
          <p
            role="alert"
            data-testid="overbook-breakfast-warning"
            className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            You ordered {breakfastQty}{' '}
            {breakfastQty === 1 ? 'breakfast' : 'breakfasts'} for{' '}
            {participantCount}{' '}
            {participantCount === 1 ? 'person' : 'people'} — sure?
          </p>
        ) : null}

        {/* landr-kat8: stripped the inline price + totals breakdown — the
            PriceSidebar's "At-hotel total · pay at check-in" pill now
            owns the canonical hotel summary (check-in/out span, per-line
            breakdown, subtotal, and the "paid directly at check-in"
            caveat). We retain a short check-in/out stay window for
            orientation inside the accommodation step so the customer
            knows which nights the rooms below cover — and we add a brief
            payment notice here (landr-sbhz.4) so the customer reads it
            while looking at the room list (the sidebar pill may be
            collapsed on mobile or below the fold on desktop). */}
        {!optedOut && selectedHotelId && rooms && rooms.length > 0 ? (
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
