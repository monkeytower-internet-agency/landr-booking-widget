import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountLinkPrompt } from '@/components/booking/AccountLinkPrompt'
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker'
import {
  BookingForm,
  type BookingSelection,
} from '@/components/booking/BookingForm'
import { Confirmation } from '@/components/booking/Confirmation'
import {
  FixedDateWindowPicker,
  expandWindowDays,
} from '@/components/booking/FixedDateWindowPicker'
import { MultiDayStep } from '@/components/booking/MultiDayStep'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import { ProductList } from '@/components/booking/ProductList'
import { ShopComingSoonStub } from '@/components/booking/ShopComingSoonStub'
import { SingleDatePicker } from '@/components/booking/SingleDatePicker'
import { getOperatorSettings } from '@/api/client'
import type { OperatorSettings, Product, SubmitBookingResponse } from '@/api/types'

type Step =
  | { name: 'pick-product' }
  | { name: 'pick-selection'; product: Product }
  | { name: 'pick-pickup'; product: Product; selection: BookingSelection }
  | {
      name: 'fill-form'
      product: Product
      selection: BookingSelection
      pickupLocationId: string | null
    }
  | { name: 'confirmed'; response: SubmitBookingResponse; email: string }

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

  const afterSelection = (product: Product, selection: BookingSelection) => {
    if (product.needs_pickup) {
      setStep({ name: 'pick-pickup', product, selection })
    } else {
      setStep({ name: 'fill-form', product, selection, pickupLocationId: null })
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header>
          <h1 className="text-xl font-semibold">Book with {operatorSlug}</h1>
        </header>

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

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorSlug={operatorSlug}
            productName={step.product.name}
            onBack={() => setStep({ name: 'pick-selection', product: step.product })}
            onConfirm={(locationId) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                selection: step.selection,
                pickupLocationId: locationId,
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
            onBack={() => {
              if (step.product.needs_pickup) {
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  selection: step.selection,
                })
              } else {
                setStep({ name: 'pick-selection', product: step.product })
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
