/**
 * landr-rw8i2 — AddressStep
 *
 * The invoice address as its OWN step right before Review. Review is a
 * read-only summary of finished data; everything the customer still has to
 * type lives on a step before it. Next stays greyed out until street, postal
 * code, city and country are filled in (staff-entered bookings may not have
 * the customer's address to hand: optional there, required publicly).
 *
 * The address is edited on `booker.billing`: this step holds it locally (so it
 * works wherever it is mounted) and mirrors every edit up through
 * `onBillingChange`, which keeps the step and the persistent draft current so
 * Back and a reload restore what was typed.
 */
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { useStaffMode } from '@/lib/staffMode'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { BillingAddressBlock } from './BillingAddressBlock'
import { ContinueAction } from './ContinueAction'
import { CustomerCommentField } from './CustomerCommentField'
import { NextAction } from './NextAction'
import {
  firstMissingBillingField,
  withBilling,
  type BillingDetails,
  type BookerDetails,
} from './detailsTypes'

export interface AddressStepProps {
  /** Card description: the product (and dates) the booking is for. */
  description?: string
  booker: BookerDetails
  /** Fires with every edit so the caller keeps `booker.billing` in step + draft. */
  onBillingChange: (billing: BillingDetails) => void
  /** The operator's ISO country, last link of the country guess chain. */
  operatorCountry?: string | null
  /** The shared "Add a note for us" field: last thing above Next. */
  customerComment: string
  onCustomerCommentChange: (comment: string) => void
  onBack?: () => void
  onConfirm: () => void
}

export function AddressStep({
  description,
  booker,
  onBillingChange,
  operatorCountry,
  customerComment,
  onCustomerCommentChange,
  onBack,
  onConfirm,
}: AddressStepProps) {
  const locale = browserLocale()
  const staff = useStaffMode()
  const required = !staff.active
  const [billing, setBilling] = useState<BillingDetails>(
    () => withBilling(booker).billing,
  )
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const missing = required ? firstMissingBillingField(billing) : undefined
  const complete = missing === undefined

  const change = (next: BillingDetails) => {
    setBilling(next)
    onBillingChange(next)
  }
  const touch = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('addressStepTitle', locale)}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Pending required control while incomplete, so it owns the
            next-action ring (ContinueAction below stands down). */}
        <NextAction
          active={!complete}
          cue={tr('enterYourBillingAddressCue', locale)}
        >
          <BillingAddressBlock
            booker={{ ...booker, billing }}
            onChange={change}
            required={required}
            touched={touched}
            onTouch={touch}
            operatorCountry={operatorCountry}
          />
        </NextAction>

        {/* The note is always the last thing, directly above Next. */}
        <CustomerCommentField
          value={customerComment}
          onChange={onCustomerCommentChange}
          collapsible
        />

        <ContinueAction
          ready={complete}
          reason={
            complete
              ? tr('readyToContinue', locale)
              : tr('addressStepGate', locale)
          }
          reasonId="address-step-gate"
          reasonTestId="address-step-gate"
          onContinue={onConfirm}
          data-testid="address-step-submit"
        />
      </CardContent>
    </Card>
  )
}
