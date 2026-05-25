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
import { CancelPage } from '@/components/booking/CancelPage'
import { Confirmation } from '@/components/booking/Confirmation'
import { DetailsStep } from '@/components/booking/DetailsStep'
import {
  DeclarationsStep,
  type CustomerDeclarations,
  type DeclarationItem,
  type LanguageOption,
} from '@/components/booking/DeclarationsStep'
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
import {
  getOperatorServiceRoles,
  getOperatorSettings,
  getProductAddons,
} from '@/api/client'
import type { OperatorSettings, Product, ServiceRole } from '@/api/types'
import {
  type Step,
  fillFormOrDeclarations,
  sidebarInputsForStep,
  stepAfterAccommodation,
} from './appStepMachine'
import { detectRoute } from './detectRoute'

// landr-sbhz.3: operators that require pre-booking customer declarations.
// v1 hardcodes the Para42 slug; v2 would fetch this from the operator settings
// API (operator_declarations table). Exact match on slug — the para42-dev-*
// test slugs do NOT match and are therefore not subject to enforcement.
const OPERATORS_REQUIRING_DECLARATIONS: ReadonlySet<string> = new Set(['para42'])

// Para42 declaration items (v1 hardcoded set).
// Extension point: replace with a fetch from /api/public/operators/{slug}/declarations
// when the operator-configurable declaration feature is implemented.
const PARA42_DECLARATION_ITEMS: DeclarationItem[] = [
  {
    key: 'license_valid',
    label:
      'I have a valid paragliding license that is accepted in Tenerife / the Canary Islands.',
  },
  {
    key: 'insurance_valid',
    label:
      'I have valid health insurance and third-party liability insurance for paragliding.',
  },
  {
    key: 'autonomous_pilot',
    label:
      'I am an autonomous paraglider at intermediate-to-advanced level and can fly independently.',
  },
  {
    key: 'emergency_contact',
    label:
      'I will provide an emergency contact (name + phone number) on the first day of the booking.',
  },
]

const PARA42_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

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
  // landr-sgnd: branch on the URL pathname before the booking flow
  // state machinery so we never spin up the operator/product fetches
  // when the customer is just here to cancel.
  const route = useMemo(
    () =>
      typeof window === 'undefined'
        ? { kind: 'booking' as const }
        : detectRoute(window.location.pathname),
    [],
  )
  if (route.kind === 'cancel') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
          <CancelPage bookingId={route.bookingId} />
        </div>
      </div>
    )
  }
  return <BookingFlowApp />
}

function BookingFlowApp() {
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
  // Operator's active service_roles (landr-mg0a). Starts empty so the
  // DetailsStep dropdown stays hidden during the fetch — BookingForm
  // falls back to the legacy 'participant' code if the customer manages
  // to submit before the list arrives (extremely unlikely; the fetch
  // races multiple full-page paints' worth of UX).
  const [serviceRoles, setServiceRoles] = useState<ServiceRole[]>([])

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const roles = await getOperatorServiceRoles(operatorSlug)
        if (!cancelled) setServiceRoles(roles)
      } catch {
        // Empty list is the safe fallback — BookingForm's || 'participant'
        // guard keeps submit working for the default-seeded operator.
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
          // landr-yf0n: hadServiceAddons=false here — the customer
          // skipped this step because the product has no add-ons.
          afterAccommodation(
            product,
            selection,
            booker,
            participants,
            [],
            null,
            [],
            false,
          )
        }
      })()
      return
    }
    // landr-yf0n: hadServiceAddons=false — product has no hotel + no
    // add-on probe ran (non-service products short-circuit here).
    afterAccommodation(
      product,
      selection,
      booker,
      participants,
      [],
      null,
      [],
      false,
    )
  }

  const afterAccommodation = (
    product: Product,
    selection: BookingSelection,
    booker: BookerDetails,
    participants: ParticipantDetails[],
    accommodationRooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[] = [],
    // landr-yf0n: provenance flags so back-nav can hop back through the
    // upstream intermediate steps with their previously confirmed state.
    hadServiceAddons: boolean = false,
    includeHotel: boolean | undefined = undefined,
    // landr-sbhz.4: shared-double flag for back-nav restoration.
    isSharedDouble: boolean | undefined = undefined,
  ) => {
    const next = stepAfterAccommodation(
      product,
      selection,
      booker,
      participants,
      accommodationRooms,
      hotelLocationId,
      addons,
      hadServiceAddons,
      includeHotel,
      // landr-sbhz.4: shared-double flag threads through for back-nav.
      isSharedDouble,
    )
    // landr-sbhz.3: if stepAfterAccommodation resolved to fill-form and
    // the operator requires declarations, convert to the declarations step
    // so the customer confirms eligibility before the review screen.
    // pick-pickup is left unchanged — the pickup step's onConfirm handler
    // also goes through fillFormOrDeclarations.
    if (next.name === 'fill-form' && OPERATORS_REQUIRING_DECLARATIONS.has(operatorSlug)) {
      setStep(fillFormOrDeclarations(next, true))
    } else {
      setStep(next)
    }
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
            serviceRoles={serviceRoles}
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
            // landr-yf0n: thread prior accommodation context back so the
            // step re-mounts with hotel + rooms + add-ons restored
            // instead of empty steppers. Each field is independently
            // optional — only what was previously confirmed comes back.
            // landr-sbhz.4: also restore the shared-double tick.
            initialHotelLocationId={step.hotelLocationId}
            initialRooms={step.accommodationRooms}
            initialAddons={step.addons}
            initialIncludeHotel={step.includeHotel}
            initialIsSharedDouble={step.isSharedDouble}
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
            onConfirm={(rooms, hotelLocationId, addons, includeHotel, isSharedDouble) =>
              afterAccommodation(
                step.product,
                step.selection,
                step.booker,
                step.participants,
                rooms,
                hotelLocationId,
                addons,
                // Carry forward whether the customer originally went
                // through ServiceAddonsStep (false here — this product
                // has a hotel offering, so the service-addons step
                // never ran).
                false,
                includeHotel,
                isSharedDouble,
              )
            }
          />
        ) : null}

        {step.name === 'pick-service-addons' ? (
          <ServiceAddonsStep
            product={step.product}
            // landr-yf0n: thread prior add-on selections back so the
            // step re-mounts with the customer's choices restored
            // instead of resetting to the min_qty seed.
            initialAddons={step.addons}
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
                // landr-yf0n: hadServiceAddons=true — the customer
                // explicitly went through ServiceAddonsStep, so back-
                // nav from downstream steps must hop back through here.
                true,
              )
            }
          />
        ) : null}

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorSlug={operatorSlug}
            productName={step.product.name}
            // landr-yf0n: thread the prior pickup choice back so the
            // radio re-mounts with it already selected on back-nav.
            initialLocationId={step.pickupLocationId}
            onBack={() => {
              const offering = step.product.hotel_offering ?? 'none'
              if (step.product.product_kind === 'service' && offering !== 'none') {
                // landr-yf0n: restore the prior accommodation state on
                // back-nav so the room steppers + add-ons aren't wiped.
                // landr-sbhz.4: also carry isSharedDouble back.
                setStep({
                  name: 'pick-accommodation',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  hotelLocationId: step.hotelLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                })
              } else if (step.hadServiceAddons) {
                // landr-yf0n: the customer originally went through
                // ServiceAddonsStep — back-nav must hop back through
                // it instead of jumping straight to DetailsStep.
                setStep({
                  name: 'pick-service-addons',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  addons: step.addons,
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
            onConfirm={(locationId) => {
              // landr-sbhz.3: route to declarations step before fill-form
              // when the operator requires pre-booking declarations.
              const fillFormArgs = {
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                pickupLocationId: locationId,
                accommodationRooms: step.accommodationRooms,
                addons: step.addons,
                // landr-yf0n: carry provenance flags through so the
                // fill-form back path can hop back through the right
                // upstream intermediate steps with their state.
                // landr-sbhz.4: also carry isSharedDouble.
                hotelLocationId: step.hotelLocationId,
                hadServiceAddons: step.hadServiceAddons,
                includeHotel: step.includeHotel,
                isSharedDouble: step.isSharedDouble,
              }
              setStep(
                fillFormOrDeclarations(
                  fillFormArgs,
                  OPERATORS_REQUIRING_DECLARATIONS.has(operatorSlug),
                ),
              )
            }}
          />
        ) : null}

        {/* landr-sbhz.3: declarations step — eligibility confirmations
            + language selector, shown before the review screen for
            operators in OPERATORS_REQUIRING_DECLARATIONS. */}
        {step.name === 'declarations' ? (
          <DeclarationsStep
            productName={step.product.name}
            declarationItems={PARA42_DECLARATION_ITEMS}
            languageOptions={PARA42_LANGUAGE_OPTIONS}
            initialDeclarations={step.initialDeclarations}
            onBack={() => {
              // Back from declarations returns to the previous step.
              // If the product needed pickup, go back to pick-pickup;
              // otherwise go back through the standard accommodation/
              // addons/details chain.
              if (step.product.needs_pickup) {
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  pickupLocationId: step.pickupLocationId,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                })
              } else {
                const offering = step.product.hotel_offering ?? 'none'
                if (
                  step.product.product_kind === 'service' &&
                  offering !== 'none'
                ) {
                  setStep({
                    name: 'pick-accommodation',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                    hotelLocationId: step.hotelLocationId,
                    accommodationRooms: step.accommodationRooms,
                    addons: step.addons,
                    includeHotel: step.includeHotel,
                    isSharedDouble: step.isSharedDouble,
                  })
                } else if (step.hadServiceAddons) {
                  setStep({
                    name: 'pick-service-addons',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                    addons: step.addons,
                  })
                } else {
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
            onConfirm={(customerDeclarations: CustomerDeclarations) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                selection: step.selection,
                booker: step.booker,
                participants: step.participants,
                pickupLocationId: step.pickupLocationId,
                accommodationRooms: step.accommodationRooms,
                addons: step.addons,
                hotelLocationId: step.hotelLocationId,
                hadServiceAddons: step.hadServiceAddons,
                includeHotel: step.includeHotel,
                isSharedDouble: step.isSharedDouble,
                customerDeclarations: customerDeclarations.declarations,
                customerLanguage: customerDeclarations.language,
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
            customerDeclarations={step.customerDeclarations}
            customerLanguage={step.customerLanguage}
            onBack={() => {
              // landr-sbhz.3: if declarations were collected, back
              // from fill-form goes to the declarations step (not all
              // the way back to pickup/accommodation) so the customer
              // can review/change declarations without losing context.
              if (OPERATORS_REQUIRING_DECLARATIONS.has(operatorSlug)) {
                setStep({
                  name: 'declarations',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  pickupLocationId: step.pickupLocationId,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  // landr-sbhz.4: keep the shared-double tick through the
                  // fill-form → declarations back hop.
                  isSharedDouble: step.isSharedDouble,
                  initialDeclarations: step.customerDeclarations
                    ? {
                        declarations: step.customerDeclarations,
                        language: step.customerLanguage ?? '',
                      }
                    : undefined,
                })
                return
              }
              if (step.product.needs_pickup) {
                // landr-yf0n: thread the prior pickupLocationId +
                // upstream provenance back so PickupLocationPicker
                // re-mounts with the prior radio choice restored AND
                // its own back button still hops back through the
                // right upstream intermediate steps.
                // landr-sbhz.4: also carry isSharedDouble.
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  selection: step.selection,
                  booker: step.booker,
                  participants: step.participants,
                  accommodationRooms: step.accommodationRooms,
                  addons: step.addons,
                  pickupLocationId: step.pickupLocationId,
                  hotelLocationId: step.hotelLocationId,
                  hadServiceAddons: step.hadServiceAddons,
                  includeHotel: step.includeHotel,
                  isSharedDouble: step.isSharedDouble,
                })
              } else {
                const offering = step.product.hotel_offering ?? 'none'
                if (step.product.product_kind === 'service' && offering !== 'none') {
                  // landr-yf0n: restore the prior accommodation state.
                  // landr-sbhz.4: also carry isSharedDouble.
                  setStep({
                    name: 'pick-accommodation',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                    hotelLocationId: step.hotelLocationId,
                    accommodationRooms: step.accommodationRooms,
                    addons: step.addons,
                    includeHotel: step.includeHotel,
                    isSharedDouble: step.isSharedDouble,
                  })
                } else if (step.hadServiceAddons) {
                  // landr-yf0n: the customer originally went through
                  // ServiceAddonsStep — back-nav must hop back through
                  // it instead of skipping to DetailsStep.
                  setStep({
                    name: 'pick-service-addons',
                    product: step.product,
                    selection: step.selection,
                    booker: step.booker,
                    participants: step.participants,
                    addons: step.addons,
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
