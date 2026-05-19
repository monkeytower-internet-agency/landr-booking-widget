import { useCallback, useMemo, useState } from 'react'
import { AccountLinkPrompt } from '@/components/booking/AccountLinkPrompt'
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker'
import { BookingForm } from '@/components/booking/BookingForm'
import { Confirmation } from '@/components/booking/Confirmation'
import {
  FixedDateWindowPicker,
  expandWindowDays,
} from '@/components/booking/FixedDateWindowPicker'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import { ProductList } from '@/components/booking/ProductList'
import type {
  AvailabilitySlot,
  Product,
  SubmitBookingResponse,
} from '@/api/types'

type PickedSlot = {
  slot: AvailabilitySlot
  /** Days to pass to the API as selected_days. For time_slot / single_days_range
   * single-pick this is [slot.date]; for fixed_date_range windows it covers the
   * full window range. */
  selectedDays: string[]
}

type Step =
  | { name: 'pick-product' }
  | { name: 'pick-slot'; product: Product }
  | { name: 'pick-pickup'; product: Product; picked: PickedSlot }
  | {
      name: 'fill-form'
      product: Product
      picked: PickedSlot
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

  const goToProductStep = useCallback(() => {
    setStep({ name: 'pick-product' })
  }, [])

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
            onSelect={(p) => setStep({ name: 'pick-slot', product: p })}
          />
        ) : null}

        {step.name === 'pick-slot' ? (
          step.product.duration_kind === 'fixed_date_range' ? (
            <FixedDateWindowPicker
              product={step.product}
              onBack={goToProductStep}
              onConfirm={(slot, window) => {
                const picked: PickedSlot = {
                  slot,
                  selectedDays: expandWindowDays(window),
                }
                if (step.product.needs_pickup) {
                  setStep({ name: 'pick-pickup', product: step.product, picked })
                } else {
                  setStep({
                    name: 'fill-form',
                    product: step.product,
                    picked,
                    pickupLocationId: null,
                  })
                }
              }}
            />
          ) : (
            <AvailabilityPicker
              product={step.product}
              onBack={goToProductStep}
              onConfirm={(slot) => {
                const picked: PickedSlot = { slot, selectedDays: [slot.date] }
                if (step.product.needs_pickup) {
                  setStep({ name: 'pick-pickup', product: step.product, picked })
                } else {
                  setStep({
                    name: 'fill-form',
                    product: step.product,
                    picked,
                    pickupLocationId: null,
                  })
                }
              }}
            />
          )
        ) : null}

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorSlug={operatorSlug}
            productName={step.product.name}
            onBack={() => setStep({ name: 'pick-slot', product: step.product })}
            onConfirm={(locationId) =>
              setStep({
                name: 'fill-form',
                product: step.product,
                picked: step.picked,
                pickupLocationId: locationId,
              })
            }
          />
        ) : null}

        {step.name === 'fill-form' ? (
          <BookingForm
            operatorSlug={operatorSlug}
            product={step.product}
            slot={step.picked.slot}
            selectedDays={step.picked.selectedDays}
            pickupLocationId={step.pickupLocationId}
            onBack={() => {
              if (step.product.needs_pickup) {
                setStep({
                  name: 'pick-pickup',
                  product: step.product,
                  picked: step.picked,
                })
              } else {
                setStep({ name: 'pick-slot', product: step.product })
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
