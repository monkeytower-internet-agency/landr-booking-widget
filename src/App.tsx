import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AccommodationStep } from '@/components/booking/AccommodationStep'
import type { RoomSelection } from '@/components/booking/accommodationCalc'
import { AccountLinkPrompt } from '@/components/booking/AccountLinkPrompt'
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker'
import {
  BookingForm,
  type BookingSelection,
} from '@/components/booking/BookingForm'
import { ServiceAddonsStep } from '@/components/booking/ServiceAddonsStep'
import type { AddonSelection } from '@/components/booking/addonsState'
import { Confirmation } from '@/components/booking/Confirmation'
import { DetailsStep } from '@/components/booking/DetailsStep'
import type {
  BookerDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import { FixedDateWindowPicker } from '@/components/booking/FixedDateWindowPicker'
import { expandWindowDays } from '@/components/booking/expandWindowDays'
import { MultiDayStep } from '@/components/booking/MultiDayStep'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import PriceSidebar from '@/components/booking/PriceSidebar'
import { ProductList } from '@/components/booking/ProductList'
import { ShopComingSoonStub } from '@/components/booking/ShopComingSoonStub'
import { SingleDatePicker } from '@/components/booking/SingleDatePicker'
import { getOperatorSettings, getProductAddons } from '@/api/client'
import type { OperatorSettings, Product } from '@/api/types'
import {
  type Step,
  sidebarInputsForStep,
  stepAfterAccommodation,
} from './appStepMachine'

function readQueryParams() {
  if (typeof window === 'undefined') {
    return { operator: null as string | null, product: null as string | null, group: null as string | null }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    operator: params.get('operator'),
    product: params.get('product'),
    group: params.get('group'),
  }
}

function App() {
  const { operator, product, group } = useMemo(() => readQueryParams(), [])
  const operatorSlug =
    operator ?? import.meta.env.VITE_DEFAULT_OPERATOR_SLUG ?? 'para42'
  const [step, setStep] = useState<Step>({ name: 'pick-product' })
  // Live selection from the date pickers before the user presses Continue
  // (landr-w7pi). Cleared whenever we leave pick-selection so the next
  // visit to that step starts fresh.
  const [liveSelectionDays, setLiveSelectionDays] = useState<string[]>([])
  // Operator-level flags (landr-e10.9). Defaults to the safe value
  // (expose_seats_to_customer=false) until the fetch resolves so the
  // first render never leaks seat counts for opted-out operators.
  // landr-yp8x adds branding fields (logo_url, primary_color, name) to
  // the same endpoint; defaults stay null so the widget renders its
  // built-in theme until the fetch resolves.
  const [operatorSettings, setOperatorSettings] = useState<OperatorSettings>({
    slug: operatorSlug,
    expose_seats_to_customer: false,
    logo_url: null,
    primary_color: null,
    name: null,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const settings = await getOperatorSettings(operatorSlug)
        if (!cancelled) setOperatorSettings(settings)
      } catch {
        // Keep the safe defaults — failing this fetch must not block booking.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorSlug])

  const goToProductStep = useCallback(() => {
    // Clear live selection so that a Back → re-enter cycle shows an
    // empty price sidebar until the user picks days again (landr-w7pi).
    setLiveSelectionDays([])
    setStep({ name: 'pick-product' })
  }, [])

  /**
   * After date selection, hand off to the DetailsStep (landr-8c03,
   * replacing the count-only ParticipantsStep from landr-mbge). The
   * DetailsStep collects full booker + participant details so the
   * downstream steps (accommodation, sidebar, review) all have the
   * party context to render names/quantities accurately.
   *
   * Non-service product_kind never reaches afterSelection (shop stub
   * fires upstream).
   */
  const afterSelection = (product: Product, selection: BookingSelection) => {
    // The live selection is now committed into the selection object; clear
    // the ephemeral state so it doesn't linger if the user ever navigates
    // back to pick-selection via Back (landr-w7pi).
    setLiveSelectionDays([])
    setStep({ name: 'details', product, selection })
  }

  /**
   * After the DetailsStep confirms booker + participants, run the
   * existing post-selection branching:
   *   1. AccommodationStep when the product offers a hotel stay
   *      (landr-vyaz). Add-ons are surfaced INSIDE that step under
   *      each room (landr-cip6).
   *   2. ServiceAddonsStep when the product has no hotel offering but
   *      DOES have add-ons configured (landr-cip6). We do a quick
   *      add-on fetch up front so customers without add-ons don't see
   *      an empty step appear and disappear.
   *   3. Straight through to pick-pickup / fill-form for products with
   *      neither hotel nor add-ons (the legacy short-circuit).
   * The accommodation/service-addons steps always return through
   * afterAccommodation which preserves the pickup-vs-form decision tree.
   */
  const afterDetails = (
    product: Product,
    selection: BookingSelection,
    booker: BookerDetails,
    participants: ParticipantDetails[],
  ) => {
    const offering = product.hotel_offering ?? 'none'
    if (product.product_kind === 'service' && offering !== 'none') {
      setStep({
        name: 'pick-accommodation',
        product,
        selection,
        booker,
        participants,
      })
      return
    }
    if (product.product_kind === 'service') {
      void (async () => {
        let hasAddons: boolean
        try {
          const addons = await getProductAddons(product.product_id)
          hasAddons = addons.length > 0
        } catch {
          hasAddons = false
        }
        if (hasAddons) {
          setStep({
            name: 'pick-service-addons',
            product,
            selection,
            booker,
            participants,
          })
        } else {
          afterAccommodation(
            product,
            selection,
            booker,
            participants,
            [],
            null,
            [],
          )
        }
      })()
      return
    }
    afterAccommodation(product, selection, booker, participants, [], null, [])
  }

  const afterAccommodation = (
    product: Product,
    selection: BookingSelection,
    booker: BookerDetails,
    participants: ParticipantDetails[],
    accommodationRooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[] = [],
  ) => {
    setStep(
      stepAfterAccommodation(
        product,
        selection,
        booker,
        participants,
        accommodationRooms,
        hotelLocationId,
        addons,
      ),
    )
  }

  /**
   * The selectedDays helper for the AccommodationStep. AvailabilityPicker
   * + time-slot bookings only carry a single date; we wrap it in a one-
   * element array so the deriveStayWindow helper still works.
   */
  const selectionToDays = (selection: BookingSelection): string[] => {
    if (selection.kind === 'slot') return [selection.slot.date]
    return selection.selectedDays
  }

  const sidebarInputs = sidebarInputsForStep(step)

  // landr-yp8x — apply the operator's primary colour as a CSS variable
  // override so every component that reads `var(--primary)` (Button,
  // PriceSidebar CTA, accent borders) automatically picks it up.
  // Setting it as inline style at the widget root means we don't
  // mutate a global stylesheet (which would leak across embeds when
  // the host page mounts more than one widget instance — uncommon but
  // possible). When primary_color is null the inline style isn't
  // applied and the index.css default kicks in.
  const brandStyle: CSSProperties = operatorSettings.primary_color
    ? ({ ['--primary' as never]: operatorSettings.primary_color } as CSSProperties)
    : {}

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={brandStyle}
    >
      {/*
        Outer flex (md and up) puts the step content on the left and the
        sticky PriceSidebar on the right. On mobile the sidebar renders
        as a fixed bottom bar (handled inside PriceSidebar), so the main
        column simply takes the full width. Wider max-w-5xl gives the
        sidebar breathing room without squeezing the step content.
      */}
      <div className="mx-auto flex max-w-5xl flex-col md:flex-row md:items-start gap-6 p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/*
          landr-yp8x — operator brand header. We deliberately keep this
          tight (logo + name, no <h1>) because the widget is embedded
          inside the operator's own page and they own the surrounding
          HTML including any <h1>. The header gives the customer a
          visual anchor inside the embed (especially when the iframe
          host page is busy) without competing with the operator's
          page title. Falls back to a text-only header when no logo is
          uploaded; renders nothing at all when both logo and name are
          unset (defensive — public_get_operator_settings always
          projects `name`).
        */}
        {(operatorSettings.logo_url || operatorSettings.name) ? (
          <div className="flex items-center gap-3">
            {operatorSettings.logo_url ? (
              <img
                src={operatorSettings.logo_url}
                alt={operatorSettings.name ?? operatorSettings.slug}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : null}
            {operatorSettings.name && !operatorSettings.logo_url ? (
              <span className="text-lg font-semibold">
                {operatorSettings.name}
              </span>
            ) : null}
          </div>
        ) : null}

        {step.name === 'pick-product' ? (
          <ProductList
            operatorSlug={operatorSlug}
            productGroup={group ?? undefined}
            preselectSlug={product ?? undefined}
            onSelect={(p) => setStep({ name: 'pick-selection', product: p })}
          />
        ) : null}

        {/*
          Step machine branching (landr-y9k). First branch is product_kind:
          non-service kinds (digital_good, physical_good, gift_card) render
          the ShopComingSoonStub since the booking widget doesn't take
          checkout for shop kinds yet. For services, branch on
          service_time_shape to pick the right picker; MultiDayPicker also
          consumes product.is_contiguous to switch between any-day-toggle
          and consecutive-only modes.
        */}
        {step.name === 'pick-selection' &&
        step.product.product_kind !== 'service' ? (
          <ShopComingSoonStub product={step.product} onBack={goToProductStep} />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'time_slot' ? (
          <AvailabilityPicker
            product={step.product}
            exposeSeatsToCustomer={operatorSettings.expose_seats_to_customer}
            onBack={goToProductStep}
            onConfirm={(slot) =>
              afterSelection(step.product, { kind: 'slot', slot })
            }
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'fixed_window' ? (
          <FixedDateWindowPicker
            product={step.product}
            exposeSeats={operatorSettings.expose_seats_to_customer}
            onBack={goToProductStep}
            onConfirm={(_slot, window) =>
              afterSelection(step.product, {
                kind: 'days',
                selectedDays: expandWindowDays(window),
              })
            }
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'days_range' ? (
          <MultiDayStep
            product={step.product}
            onBack={goToProductStep}
            onConfirm={(selectedDays) =>
              afterSelection(step.product, { kind: 'days', selectedDays })
            }
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'pick-selection' &&
        step.product.product_kind === 'service' &&
        step.product.service_time_shape === 'single_date' ? (
          <SingleDatePicker
            product={step.product}
            onBack={goToProductStep}
            onConfirm={(selectedDays) =>
              afterSelection(step.product, { kind: 'days', selectedDays })
            }
            onLiveDaysChange={setLiveSelectionDays}
          />
        ) : null}

        {step.name === 'details' ? (
          <DetailsStep
            product={step.product}
            selection={step.selection}
            initialBooker={step.booker}
            initialParticipants={step.participants}
            onBack={() =>
              setStep({ name: 'pick-selection', product: step.product })
            }
            onConfirm={(booker, participants) =>
              afterDetails(step.product, step.selection, booker, participants)
            }
          />
        ) : null}

        {step.name === 'pick-accommodation' ? (
          <AccommodationStep
            product={step.product}
            selectedDays={selectionToDays(step.selection)}
            operatorSlug={operatorSlug}
            participantCount={step.participants.length}
            onBack={() =>
              // landr-b3g5: thread the already-collected booker +
              // participants back to DetailsStep so the form re-mounts
              // pre-filled instead of empty.
              setStep({
                name: 'details',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
              })
            }
            onConfirm={(rooms, hotelLocationId, addons) =>
              afterAccommodation(
                step.product,
                step.selection,
                step.booker,
                step.participants,
                rooms,
                hotelLocationId,
                addons,
              )
            }
          />
        ) : null}

        {step.name === 'pick-service-addons' ? (
          <ServiceAddonsStep
            product={step.product}
            onBack={() =>
              // landr-b3g5: carry booker + participants back so the
              // DetailsStep re-mount restores them.
              setStep({
                name: 'details',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
              })
            }
            onConfirm={(addons) =>
              afterAccommodation(
                step.product,
                step.selection,
                step.booker,
                step.participants,
                [],
                null,
                addons,
              )
            }
          />
        ) : null}

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorSlug={operatorSlug}
            productName={step.product.name}
            onBack={() => {
              const offering = step.product.hotel_offering ?? 'none'
              if (step.product.product_kind === 'service' && offering !== 'none') {
                setStep({
                  name: 'pick-accommodation',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                })
              } else {
                // landr-b3g5: preserve booker + participants when
                // back-stepping into DetailsStep.
                setStep({
                  name: 'details',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                })
              }
            }}
            onConfirm={(locationId) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                pickupLocationId: locationId,
                accommodationRooms: step.accommodationRooms,
                addons: step.addons,
              })
            }
          />
        ) : null}

        {step.name === 'fill-form' ? (
          <BookingForm
            operatorSlug={operatorSlug}
            product={step.product}
            selection={step.selection}
            booker={step.booker}
            participants={step.participants}
            pickupLocationId={step.pickupLocationId}
            accommodationRooms={step.accommodationRooms}
            addons={step.addons}
            onBack={() => {
              if (step.product.needs_pickup) {
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                })
              } else {
                const offering = step.product.hotel_offering ?? 'none'
                if (step.product.product_kind === 'service' && offering !== 'none') {
                  setStep({
                    name: 'pick-accommodation',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                  })
                } else {
                  // landr-b3g5: preserve booker + participants when
                  // back-stepping from fill-form into DetailsStep.
                  setStep({
                    name: 'details',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                  })
                }
              }
            }}
            onConfirmed={(response, email) =>
              setStep({ name: 'confirmed', response, email })
            }
          />
        ) : null}

        {step.name === 'confirmed' ? (
          <>
            <Confirmation response={step.response} onRestart={goToProductStep} />
            <AccountLinkPrompt email={step.email} />
          </>
        ) : null}
        </div>
        {sidebarInputs ? (
          <PriceSidebar
            operatorSlug={operatorSlug}
            product={sidebarInputs.product}
            selectedDays={
              step.name === 'pick-selection'
                ? liveSelectionDays
                : sidebarInputs.selectedDays
            }
            participantCount={sidebarInputs.participantCount}
            participantNames={sidebarInputs.participantNames}
            accommodationRooms={sidebarInputs.accommodationRooms}
            addons={sidebarInputs.addons}
            debounceMs={step.name === 'pick-selection' ? 1500 : undefined}
          />
        ) : null}
      </div>
    </div>
  )
}

export default App
