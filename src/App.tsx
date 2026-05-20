import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { FixedDateWindowPicker } from '@/components/booking/FixedDateWindowPicker'
import { expandWindowDays } from '@/components/booking/expandWindowDays'
import { MultiDayStep } from '@/components/booking/MultiDayStep'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import { ProductList } from '@/components/booking/ProductList'
import { ShopComingSoonStub } from '@/components/booking/ShopComingSoonStub'
import { SingleDatePicker } from '@/components/booking/SingleDatePicker'
import { getOperatorSettings, getProductAddons } from '@/api/client'
import type { OperatorSettings, Product } from '@/api/types'
import { type Step, stepAfterAccommodation } from './appStepMachine'

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
  // Operator-level flags (landr-e10.9). Defaults to the safe value
  // (expose_seats_to_customer=false) until the fetch resolves so the
  // first render never leaks seat counts for opted-out operators.
  const [operatorSettings, setOperatorSettings] = useState<OperatorSettings>({
    slug: operatorSlug,
    expose_seats_to_customer: false,
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
    setStep({ name: 'pick-product' })
  }, [])

  /**
   * After date selection, branch into:
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
  const afterSelection = (product: Product, selection: BookingSelection) => {
    const offering = product.hotel_offering ?? 'none'
    if (product.product_kind === 'service' && offering !== 'none') {
      setStep({ name: 'pick-accommodation', product, selection })
      return
    }
    if (product.product_kind === 'service') {
      // Quick add-on probe — only insert the add-ons step when the
      // product actually has at least one linked add-on. A failure
      // (network blip) short-circuits to the legacy no-addons path so
      // customers are never stranded.
      void (async () => {
        let hasAddons: boolean
        try {
          const addons = await getProductAddons(product.product_id)
          hasAddons = addons.length > 0
        } catch {
          // Probe failure short-circuits to the legacy no-addons path so
          // a network blip never leaves the customer stranded.
          hasAddons = false
        }
        if (hasAddons) {
          setStep({ name: 'pick-service-addons', product, selection })
        } else {
          afterAccommodation(product, selection, [], null, [])
        }
      })()
      return
    }
    // Non-service products go straight to the shop stub upstream;
    // afterSelection is only called for services.
    afterAccommodation(product, selection, [], null, [])
  }

  const afterAccommodation = (
    product: Product,
    selection: BookingSelection,
    accommodationRooms: RoomSelection[],
    hotelLocationId: string | null,
    addons: AddonSelection[] = [],
  ) => {
    setStep(
      stepAfterAccommodation(
        product,
        selection,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        {/*
          landr-711: no widget-level headline. Operators embed the widget
          inside their own page (WordPress shortcode / iframe) and own the
          surrounding HTML, including any <h1>. The operator context is
          still fetched above for downstream step-machine + product
          requests — it just isn't rendered as a title here.
        */}

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
          />
        ) : null}

        {step.name === 'pick-accommodation' ? (
          <AccommodationStep
            product={step.product}
            selectedDays={selectionToDays(step.selection)}
            operatorSlug={operatorSlug}
            onBack={() => setStep({ name: 'pick-selection', product: step.product })}
            onConfirm={(rooms, hotelLocationId, addons) =>
              afterAccommodation(
                step.product,
                step.selection,
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
              setStep({ name: 'pick-selection', product: step.product })
            }
            onConfirm={(addons) =>
              afterAccommodation(step.product, step.selection, [], null, addons)
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
                })
              } else {
                setStep({ name: 'pick-selection', product: step.product })
              }
            }}
            onConfirm={(locationId) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                selection: step.selection,
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
            pickupLocationId={step.pickupLocationId}
            accommodationRooms={step.accommodationRooms}
            addons={step.addons}
            onBack={() => {
              if (step.product.needs_pickup) {
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  selection: step.selection,
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
                  })
                } else {
                  setStep({ name: 'pick-selection', product: step.product })
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
    </div>
  )
}

export default App
