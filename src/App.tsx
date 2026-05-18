import { useCallback, useMemo, useState } from 'react'
import { AccountLinkPrompt } from '@/components/booking/AccountLinkPrompt'
import { AvailabilityPicker } from '@/components/booking/AvailabilityPicker'
import { BookingForm } from '@/components/booking/BookingForm'
import { Confirmation } from '@/components/booking/Confirmation'
import { PickupLocationPicker } from '@/components/booking/PickupLocationPicker'
import { ProductList } from '@/components/booking/ProductList'
import type {
  AvailabilitySlot,
  Product,
  SubmitBookingResponse,
} from '@/api/types'

type Step =
  | { name: 'pick-product' }
  | { name: 'pick-slot'; product: Product }
  | { name: 'pick-pickup'; product: Product; slot: AvailabilitySlot }
  | { name: 'fill-form'; product: Product; slot: AvailabilitySlot; pickupLocationId: string | null }
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
          <AvailabilityPicker
            product={step.product}
            onBack={goToProductStep}
            onConfirm={(slot) => {
              if (step.product.needs_pickup) {
                setStep({ name: 'pick-pickup', product: step.product, slot })
              } else {
                setStep({ name: 'fill-form', product: step.product, slot, pickupLocationId: null })
              }
            }}
          />
        ) : null}

        {step.name === 'pick-pickup' ? (
          <PickupLocationPicker
            operatorSlug={operatorSlug}
            productName={step.product.name}
            onBack={() => setStep({ name: 'pick-slot', product: step.product })}
            onConfirm={(locationId) =>
              setStep({ name: 'fill-form', product: step.product, slot: step.slot, pickupLocationId: locationId })
            }
          />
        ) : null}

        {step.name === 'fill-form' ? (
          <BookingForm
            operatorSlug={operatorSlug}
            product={step.product}
            slot={step.slot}
            pickupLocationId={step.pickupLocationId}
            onBack={() => {
              if (step.product.needs_pickup) {
                setStep({ name: 'pick-pickup', product: step.product, slot: step.slot })
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
