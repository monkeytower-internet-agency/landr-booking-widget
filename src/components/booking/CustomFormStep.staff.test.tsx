/**
 * Staff mode on the custom-form step: the form defaults to "customer completes
 * this" (compact card), "Fill in now instead" expands the normal form, and
 * without a staff session the step is the unchanged public form.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomFormStep } from './CustomFormStep'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'
import type { ProductFlowResponse } from '@/api/flowTypes'

vi.mock('@/api/client', () => ({ getProductFlow: vi.fn() }))

const STAFF: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'op-1',
}

const FLOW: ProductFlowResponse = {
  modules: [
    {
      kind: 'custom_form',
      position: 0,
      form: {
        key: 'intake',
        version: 1,
        name: 'Intake Form',
        name_localized: null,
        fields: [
          {
            key: 'full_name',
            field_type: 'text',
            label: 'Full name',
            label_localized: null,
            help_text: null,
            help_text_localized: null,
            required: true,
            position: 0,
            options: null,
            validation: null,
            visibility_rule: null,
          },
        ],
      },
    },
  ],
}

function renderStep(opts: {
  staff: boolean
  withHandler?: boolean
  initialAnswers?: Record<string, unknown>
}) {
  const onConfirm = vi.fn()
  const onCustomerCompletes = vi.fn()
  render(
    <StaffModeProvider value={opts.staff ? STAFF : undefined}>
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="intake"
        productName="Tandem Flight"
        flow={FLOW}
        initialAnswers={opts.initialAnswers}
        onBack={vi.fn()}
        onConfirm={onConfirm}
        onCustomerCompletes={
          opts.withHandler === false ? undefined : onCustomerCompletes
        }
      />
    </StaffModeProvider>,
  )
  return { onConfirm, onCustomerCompletes }
}

describe('CustomFormStep — staff mode', () => {
  it('defaults to the customer-completes card: no fields, Continue hands the form to the customer', () => {
    const { onConfirm, onCustomerCompletes } = renderStep({ staff: true })
    expect(screen.getByTestId('cf-customer-completes')).toHaveTextContent(
      /Customer completes this via their booking link/,
    )
    expect(screen.queryByTestId('cf-field-full_name')).toBeNull()
    // Continue is enabled although the required field is empty.
    const cont = screen.getByTestId('cf-submit')
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onCustomerCompletes).toHaveBeenCalledWith({
      form_key: 'intake',
      name: 'Intake Form',
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('"Fill in now instead" expands the normal form and submits answers via onConfirm', async () => {
    const { onConfirm, onCustomerCompletes } = renderStep({ staff: true })
    fireEvent.click(screen.getByTestId('cf-fill-in-now'))
    await waitFor(() => expect(screen.getByTestId('cf-field-full_name')).toBeTruthy())
    expect(screen.queryByTestId('cf-customer-completes')).toBeNull()
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
    fireEvent.change(screen.getByTestId('cf-field-full_name'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0]![0]).toMatchObject({
      form_key: 'intake',
      answers: { full_name: 'Ada' },
    })
    expect(onCustomerCompletes).not.toHaveBeenCalled()
  })

  it('re-opens expanded when the operator already filled the form in (back-nav)', () => {
    renderStep({ staff: true, initialAnswers: { full_name: 'Ada' } })
    expect(screen.queryByTestId('cf-customer-completes')).toBeNull()
    expect(screen.getByTestId('cf-field-full_name')).toHaveValue('Ada')
  })

  it('the expanded form lets the operator hand it back to the customer', () => {
    const { onCustomerCompletes } = renderStep({
      staff: true,
      initialAnswers: { full_name: 'Ada' },
    })
    fireEvent.click(screen.getByTestId('cf-let-customer-complete'))
    expect(onCustomerCompletes).toHaveBeenCalledWith({
      form_key: 'intake',
      name: 'Intake Form',
    })
  })
})

describe('CustomFormStep — no staff session (public widget unchanged)', () => {
  it('renders the normal form even when the staff handler is wired', () => {
    renderStep({ staff: false })
    expect(screen.queryByTestId('cf-customer-completes')).toBeNull()
    expect(screen.queryByTestId('cf-fill-in-now')).toBeNull()
    expect(screen.queryByTestId('cf-let-customer-complete')).toBeNull()
    expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
  })

  it('staff session without the handler also renders the normal form', () => {
    renderStep({ staff: true, withHandler: false })
    expect(screen.queryByTestId('cf-customer-completes')).toBeNull()
    expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
  })
})
