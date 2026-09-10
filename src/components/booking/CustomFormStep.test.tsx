/**
 * landr-71kz.4 — CustomFormStep unit tests.
 *
 * Covers:
 *   - Renders a loading state while fetching.
 *   - Renders a fetch error message when the flow call fails.
 *   - Renders a fetch error when the form key is not found in the flow.
 *   - Renders all visible fields for a given form def.
 *   - Hidden fields (via visibility rule) are NOT rendered.
 *   - A field becomes visible when its condition is satisfied (live conditional).
 *   - Required validation: Continue disabled when required field is empty.
 *   - Back button calls onBack.
 *   - onConfirm is called with pruned answers (hidden-field answers dropped).
 *   - Back-nav restoration: initialAnswers seeds the form.
 *   - Number field: sends value as string.
 *   - Checkbox/multiselect: sends list of checked option values.
 *   - No-throw guarantee: malformed getProductFlow responses never crash the widget.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomFormStep } from './CustomFormStep'
import type { ProductFlowResponse } from '@/api/flowTypes'

// ─── Mock @/api/client ────────────────────────────────────────────────────────

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getProductFlow: vi.fn<(token: string, productId: string) => Promise<ProductFlowResponse | null>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getProductFlow: mocks.getProductFlow,
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFlow(overrides?: Partial<ProductFlowResponse>): ProductFlowResponse {
  return {
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
            {
              key: 'kind',
              field_type: 'select',
              label: 'Kind',
              label_localized: null,
              help_text: null,
              help_text_localized: null,
              required: false,
              position: 1,
              options: [
                { value: 'standard', label: 'Standard', label_localized: null },
                { value: 'other', label: 'Other', label_localized: null },
              ],
              validation: null,
              visibility_rule: null,
            },
            {
              key: 'other_detail',
              field_type: 'text',
              label: 'Other detail',
              label_localized: null,
              help_text: 'Please describe',
              help_text_localized: null,
              required: false,
              position: 2,
              options: null,
              validation: null,
              visibility_rule: { field_key: 'kind', op: 'eq', value: 'other' },
            },
          ],
        },
      },
    ],
    ...overrides,
  }
}

function renderStep(props?: Partial<Parameters<typeof CustomFormStep>[0]>) {
  const defaults = {
    operatorToken: 'tok',
    productId: 'p1',
    formKey: 'intake',
    productName: 'Tandem Flight',
    onBack: vi.fn(),
    onConfirm: vi.fn(),
  }
  return render(<CustomFormStep {...defaults} {...props} />)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomFormStep — loading state', () => {
  it('shows a loading indicator while fetching', () => {
    // Never resolves during this test.
    mocks.getProductFlow.mockReturnValue(new Promise(() => {}))
    renderStep()
    expect(screen.getByTestId('cf-loading')).toBeTruthy()
  })
})

describe('CustomFormStep — fetch error', () => {
  it('shows a fetch error message when the flow call rejects', async () => {
    mocks.getProductFlow.mockRejectedValue(new Error('network error'))
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-fetch-error')).toBeTruthy()
    })
  })

  it('shows a fetch error when the form key is not in the flow', async () => {
    mocks.getProductFlow.mockResolvedValue({ modules: [] })
    renderStep({ formKey: 'nonexistent' })
    await waitFor(() => {
      expect(screen.getByTestId('cf-fetch-error')).toBeTruthy()
    })
  })

  it('shows a fetch error when the flow returns modules: null', async () => {
    mocks.getProductFlow.mockResolvedValue({ modules: null })
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-fetch-error')).toBeTruthy()
    })
  })
})

describe('CustomFormStep — renders fields', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makeFlow())
  })

  it('renders a text field for "full_name"', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
    })
  })

  it('renders a select field for "kind"', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-kind')).toBeTruthy()
    })
  })

  it('does NOT render the conditional "other_detail" field initially (kind is empty)', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
    })
    // The rule: show other_detail iff kind === 'other'. Initially no value → hidden.
    expect(screen.queryByTestId('cf-field-other_detail')).toBeNull()
  })

  it('shows the conditional "other_detail" field when kind is set to "other"', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-kind')).toBeTruthy()
    })
    // Select "other" in the kind dropdown.
    fireEvent.change(screen.getByTestId('cf-field-kind'), {
      target: { value: 'other' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-other_detail')).toBeTruthy()
    })
  })

  it('hides the conditional field again when kind is changed away from "other"', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-kind')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-kind'), {
      target: { value: 'other' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-other_detail')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-kind'), {
      target: { value: 'standard' },
    })
    await waitFor(() => {
      expect(screen.queryByTestId('cf-field-other_detail')).toBeNull()
    })
  })
})

describe('CustomFormStep — validation', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makeFlow())
  })

  it('disables Continue until the required field is filled', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeTruthy()
    })
    // Required full_name empty → Continue is greyed out.
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
    fireEvent.change(screen.getByTestId('cf-field-full_name'), {
      target: { value: 'Ada' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeEnabled()
    })
  })

  it('does not call onConfirm when validation fails', async () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm when all required fields are filled', async () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-full_name'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
  })
})

describe('CustomFormStep — pruning hidden-field answers on submit', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makeFlow())
  })

  it('prunes the hidden conditional field from the FormResponseEntry', async () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-full_name')).toBeTruthy()
    })

    // Fill the required field.
    fireEvent.change(screen.getByTestId('cf-field-full_name'), {
      target: { value: 'Ada Lovelace' },
    })
    // Set kind to 'other' to reveal other_detail.
    fireEvent.change(screen.getByTestId('cf-field-kind'), {
      target: { value: 'other' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-other_detail')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-other_detail'), {
      target: { value: 'my detail' },
    })
    // Now change kind BACK to 'standard' — other_detail becomes hidden.
    fireEvent.change(screen.getByTestId('cf-field-kind'), {
      target: { value: 'standard' },
    })
    await waitFor(() => {
      expect(screen.queryByTestId('cf-field-other_detail')).toBeNull()
    })

    // Submit — other_detail must be PRUNED from the entry.
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { form_key: string; answers: Record<string, unknown> }
    expect(entry.form_key).toBe('intake')
    expect(entry.answers).toHaveProperty('full_name', 'Ada Lovelace')
    expect(entry.answers).toHaveProperty('kind', 'standard')
    // Hidden field pruned.
    expect(entry.answers).not.toHaveProperty('other_detail')
  })
})

describe('CustomFormStep — back-nav restoration via initialAnswers', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makeFlow())
  })

  it('pre-fills the text field from initialAnswers', async () => {
    renderStep({ initialAnswers: { full_name: 'Grace Hopper', kind: 'standard' } })
    await waitFor(() => {
      const input = screen.getByTestId('cf-field-full_name') as HTMLInputElement
      expect(input.value).toBe('Grace Hopper')
    })
  })
})

describe('CustomFormStep — back button', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makeFlow())
  })

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn()
    renderStep({ onBack })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('CustomFormStep — no-throw guarantee', () => {
  it('does not crash when getProductFlow returns null', async () => {
    mocks.getProductFlow.mockResolvedValue(null)
    expect(() => renderStep()).not.toThrow()
    await waitFor(() => {
      expect(screen.getByTestId('cf-fetch-error')).toBeTruthy()
    })
  })

  it('does not crash when getProductFlow returns a completely malformed response', async () => {
    mocks.getProductFlow.mockResolvedValue({ modules: 'bad' as never })
    expect(() => renderStep()).not.toThrow()
    await waitFor(() => {
      expect(screen.getByTestId('cf-fetch-error')).toBeTruthy()
    })
  })

  it('does not crash when a field def has a completely missing type', async () => {
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'intake',
            version: 1,
            name: 'Intake',
            name_localized: null,
            fields: [
              {
                key: 'bad_field',
                field_type: 'unknown_type' as never,
                label: 'Bad',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: false,
                position: 0,
                options: null,
                validation: null,
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    expect(() => renderStep()).not.toThrow()
    await waitFor(() => {
      // Unknown type renders a degraded "unsupported" notice, NOT a crash.
      expect(screen.getByTestId('cf-field-bad_field')).toBeTruthy()
    })
  })
})

describe('CustomFormStep — checkbox/multiselect field', () => {
  it('sends a list of checked option values on submit', async () => {
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'consent_form',
            version: 1,
            name: 'Consent',
            name_localized: null,
            fields: [
              {
                key: 'consent',
                field_type: 'checkbox',
                label: 'Consent',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: true,
                position: 0,
                options: [
                  { value: 'agree', label: 'I agree', label_localized: null },
                  { value: 'marketing', label: 'Marketing', label_localized: null },
                ],
                validation: null,
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="consent_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-checkbox-consent-agree')).toBeTruthy()
    })
    // Check the first option only.
    fireEvent.click(screen.getByTestId('cf-checkbox-consent-agree'))
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    expect(entry.answers.consent).toEqual(['agree'])
  })
})

describe('CustomFormStep — number field sends string', () => {
  it('sends number input value as a string', async () => {
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'weight_form',
            version: 1,
            name: 'Weight',
            name_localized: null,
            fields: [
              {
                key: 'weight_kg',
                field_type: 'number',
                label: 'Weight (kg)',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: true,
                position: 0,
                options: null,
                validation: { min: 30, max: 200, min_length: null, max_length: null, pattern: null },
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="weight_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-weight_kg')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-weight_kg'), {
      target: { value: '75' },
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    // Number input must be sent as a STRING (landr-71kz.2 §1 contract).
    expect(entry.answers.weight_kg).toBe('75')
  })

  it('disables Continue while a number is below min, enables when valid', async () => {
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'weight_form',
            version: 1,
            name: 'Weight',
            name_localized: null,
            fields: [
              {
                key: 'weight_kg',
                field_type: 'number',
                label: 'Weight (kg)',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: true,
                position: 0,
                options: null,
                validation: { min: 30, max: 200, min_length: null, max_length: null, pattern: null },
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="weight_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-weight_kg')).toBeTruthy()
    })
    // Below min (10 < 30) → invalid → Continue stays disabled.
    fireEvent.change(screen.getByTestId('cf-field-weight_kg'), {
      target: { value: '10' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeDisabled()
    })
    // Valid value → enabled.
    fireEvent.change(screen.getByTestId('cf-field-weight_kg'), {
      target: { value: '75' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeEnabled()
    })
  })

  it('fails open on a non-numeric min (bad validation blob, never 500s)', async () => {
    // Simulates the server's C1 fix: non-numeric bounds are skipped, not crashed.
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'weight_form',
            version: 1,
            name: 'Weight',
            name_localized: null,
            fields: [
              {
                key: 'weight_kg',
                field_type: 'number',
                label: 'Weight',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: false,
                position: 0,
                options: null,
                // Non-numeric min is a free jsonb blob on the server — must not crash.
                validation: { min: 'not-a-number' as never, max: null, min_length: null, max_length: null, pattern: null },
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="weight_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-field-weight_kg')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('cf-field-weight_kg'), { target: { value: '5' } })
    // Should NOT throw and should proceed (fail-open on bad min).
    expect(() => fireEvent.click(screen.getByTestId('cf-submit'))).not.toThrow()
    await waitFor(() => {
      // No error for weight_kg (bad min skipped).
      expect(screen.queryByTestId('cf-error-weight_kg')).toBeNull()
      expect(onConfirm).toHaveBeenCalled()
    })
  })
})

// ─── landr-71kz.9: para42 data-path smoke test ────────────────────────────────
//
// BLOCKER NOTE (landr-71kz.9): App.tsx does NOT yet fetch getProductFlow or call
// buildFlowPlan with a remote flow — it always uses the legacy null-remoteFlow
// path (OPERATORS_REQUIRING_DECLARATIONS / fillFormOrDeclarations / DeclarationsStep).
// The step machine helpers (stepAfterAccommodation, stepBeforeReview) similarly
// always call legacyMiddleKinds(..., null). No setStep({ name: 'custom-form' })
// is ever built from live RPC data in the widget today.
//
// This test proves that IF App.tsx routed to <CustomFormStep> with the para42
// customer_declarations form shape (as seeded by landr-71kz.8), the component
// renders all 4 declaration checkboxes + the language field, and onConfirm
// receives a FormResponseEntry with form_key === 'customer_declarations' and the
// expected checkbox answers. That is the FULL data-path contract.
//
// The hardcoded path (OPERATORS_REQUIRING_DECLARATIONS / DeclarationsStep) MUST
// remain in App.tsx until the missing App-level wiring is added:
//   - App.tsx fetches getProductFlow(token, productId) after product selection.
//   - buildFlowPlan(product, settings, remoteFlow) is called with the result.
//   - When the plan contains a custom_form module, setStep({ name: 'custom-form',
//     formKey }) is used instead of fillFormOrDeclarations with requiresDeclarations.
//   - breadcrumb / back-nav for 'custom-form' replaces the 'declarations' special-case.
// That wiring is tracked in the parent epic (landr-71kz) — a new child ticket is
// needed (suggested: landr-71kz.10 "widget: wire remote flow into App.tsx step routing").

/** The para42 customer_declarations form fixture — mirrors the DB seed from landr-71kz.8. */
function makePara42Flow(): import('@/api/flowTypes').ProductFlowResponse {
  return {
    modules: [
      {
        kind: 'custom_form',
        position: 0,
        form: {
          key: 'customer_declarations',
          version: 1,
          name: 'Before you book',
          name_localized: null,
          fields: [
            {
              key: 'license_valid',
              field_type: 'checkbox',
              label: 'Eligibility confirmations',
              label_localized: null,
              help_text: null,
              help_text_localized: null,
              required: true,
              position: 0,
              options: [
                {
                  value: 'license_valid',
                  label: 'I have a valid paragliding license that is accepted in Tenerife / the Canary Islands.',
                  label_localized: null,
                },
                {
                  value: 'insurance_valid',
                  label: 'I have valid health insurance and third-party liability insurance for paragliding.',
                  label_localized: null,
                },
                {
                  value: 'autonomous_pilot',
                  label: 'I am an autonomous paraglider at intermediate-to-advanced level and can fly independently.',
                  label_localized: null,
                },
                {
                  value: 'emergency_contact',
                  label: 'I will provide an emergency contact (name + phone number) on the first day of the booking.',
                  label_localized: null,
                },
              ],
              validation: null,
              visibility_rule: null,
            },
            {
              key: 'spoken_language',
              field_type: 'select',
              label: 'Spoken language',
              label_localized: null,
              help_text: 'Select the language you are comfortable being guided in.',
              help_text_localized: null,
              required: true,
              position: 1,
              options: [
                { value: 'en', label: 'English', label_localized: null },
                { value: 'de', label: 'Deutsch', label_localized: null },
                { value: 'es', label: 'Español', label_localized: null },
                { value: 'fr', label: 'Français', label_localized: null },
              ],
              validation: null,
              visibility_rule: null,
            },
          ],
        },
      },
    ],
  }
}

describe('CustomFormStep — landr-71kz.9: para42 data-path contract', () => {
  beforeEach(() => {
    mocks.getProductFlow.mockResolvedValue(makePara42Flow())
  })

  it('renders the declaration checkboxes and language select from the para42 flow fixture', async () => {
    render(
      <CustomFormStep
        operatorToken="para42-token"
        productId="p-para42"
        formKey="customer_declarations"
        productName="Paragliding Week"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => {
      // All four declaration options must render as checkbox options.
      expect(screen.getByTestId('cf-checkbox-license_valid-license_valid')).toBeTruthy()
      expect(screen.getByTestId('cf-checkbox-license_valid-insurance_valid')).toBeTruthy()
      expect(screen.getByTestId('cf-checkbox-license_valid-autonomous_pilot')).toBeTruthy()
      expect(screen.getByTestId('cf-checkbox-license_valid-emergency_contact')).toBeTruthy()
      // Language select must render.
      expect(screen.getByTestId('cf-field-spoken_language')).toBeTruthy()
    })
  })

  it('disables Continue until declarations + a language are provided', async () => {
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="para42-token"
        productId="p-para42"
        formKey="customer_declarations"
        productName="Paragliding Week"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeTruthy()
    })

    // Nothing provided → Continue greyed out.
    expect(screen.getByTestId('cf-submit')).toBeDisabled()

    // Tick a required declaration + pick a language → all required satisfied → enabled.
    fireEvent.click(screen.getByTestId('cf-checkbox-license_valid-license_valid'))
    fireEvent.change(screen.getByTestId('cf-field-spoken_language'), {
      target: { value: 'en' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeEnabled()
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm with form_key=customer_declarations and checkbox answers + language on full submit', async () => {
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="para42-token"
        productId="p-para42"
        formKey="customer_declarations"
        productName="Paragliding Week"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-checkbox-license_valid-license_valid')).toBeTruthy()
    })

    // Check all four declaration options.
    fireEvent.click(screen.getByTestId('cf-checkbox-license_valid-license_valid'))
    fireEvent.click(screen.getByTestId('cf-checkbox-license_valid-insurance_valid'))
    fireEvent.click(screen.getByTestId('cf-checkbox-license_valid-autonomous_pilot'))
    fireEvent.click(screen.getByTestId('cf-checkbox-license_valid-emergency_contact'))

    // Select a language.
    fireEvent.change(screen.getByTestId('cf-field-spoken_language'), {
      target: { value: 'en' },
    })

    fireEvent.click(screen.getByTestId('cf-submit'))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })

    const entry = onConfirm.mock.calls[0][0] as { form_key: string; answers: Record<string, unknown> }
    expect(entry.form_key).toBe('customer_declarations')
    // All four declaration values must be in the checkbox array.
    expect(entry.answers.license_valid).toEqual(
      expect.arrayContaining(['license_valid', 'insurance_valid', 'autonomous_pilot', 'emergency_contact']),
    )
    // Language must be sent as a string (select field).
    expect(entry.answers.spoken_language).toBe('en')
  })
})

// landr — the `language` field_type (WITH options) must render as a RANKED,
// draggable, MULTI-SELECT picker: the customer ticks every language they speak
// and drags them into preference order. The submitted value is the ARRAY of
// selected codes in top-down order (the first is the preferred language the
// backend uses for the email locale). The no-options branch stays a free-text
// <input> (covered by App.test.tsx's declarationsFlow fixture, options: null).
function langFlow(required = true) {
  return {
    modules: [
      {
        kind: 'custom_form' as const,
        position: 0,
        form: {
          key: 'lang_form',
          version: 1,
          name: 'Language',
          name_localized: null,
          fields: [
            {
              key: 'language',
              field_type: 'language' as const,
              label: 'Spoken languages',
              label_localized: null,
              help_text: null,
              help_text_localized: null,
              required,
              position: 0,
              options: [
                { value: 'en', label: 'English', label_localized: null },
                { value: 'de', label: 'Deutsch', label_localized: null },
                { value: 'es', label: 'Español', label_localized: null },
              ],
              validation: null,
              visibility_rule: null,
            },
          ],
        },
      },
    ],
  }
}

function renderLangStep(onConfirm = vi.fn()) {
  render(
    <CustomFormStep
      operatorToken="tok"
      productId="p1"
      formKey="lang_form"
      productName="Tandem"
      onBack={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

describe('CustomFormStep — ranked language picker', () => {
  it('renders a draggable multi-select picker (not a text input) and submits an array of ticked codes', async () => {
    mocks.getProductFlow.mockResolvedValue(langFlow())
    const onConfirm = renderLangStep()

    await waitFor(() => {
      expect(screen.getByTestId('cf-lang-row-en')).toBeTruthy()
    })
    // A row exists per option — this is a list, NOT a single free-text <input>.
    expect(screen.getByTestId('cf-lang-row-en')).toBeTruthy()
    expect(screen.getByTestId('cf-lang-row-de')).toBeTruthy()
    expect(screen.getByTestId('cf-lang-row-es')).toBeTruthy()
    expect(screen.getByTestId('cf-field-language').tagName).not.toBe('INPUT')

    // Tick TWO languages.
    fireEvent.click(screen.getByTestId('cf-lang-check-en'))
    fireEvent.click(screen.getByTestId('cf-lang-check-de'))
    fireEvent.click(screen.getByTestId('cf-submit'))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    // The submitted answer is an ARRAY of the ticked codes (order = top-down).
    expect(Array.isArray(entry.answers.language)).toBe(true)
    expect(entry.answers.language).toEqual(['en', 'de'])
  })

  it('toggles a language by clicking the whole chip (not just the tick box)', async () => {
    mocks.getProductFlow.mockResolvedValue(langFlow())
    const onConfirm = renderLangStep()

    await waitFor(() => {
      expect(screen.getByTestId('cf-lang-row-de')).toBeTruthy()
    })
    // Click the chip BODY (the row), not the cf-lang-check checkbox.
    fireEvent.click(screen.getByTestId('cf-lang-row-de'))
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeEnabled()
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    expect(entry.answers.language).toEqual(['de'])
  })

  it('disables Continue when the required language picker has nothing ticked, enables after one tick', async () => {
    mocks.getProductFlow.mockResolvedValue(langFlow(true))
    const onConfirm = renderLangStep()

    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeTruthy()
    })
    // Nothing ticked → empty array counts as missing → Continue greyed out.
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()

    // Tick one → required satisfied → enabled, and submit works.
    fireEvent.click(screen.getByTestId('cf-lang-check-es'))
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeEnabled()
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    expect(entry.answers.language).toEqual(['es'])
  })

  it('seeds the picker order + selection from initialAnswers (back-nav restoration)', async () => {
    mocks.getProductFlow.mockResolvedValue(langFlow())
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="lang_form"
        productName="Tandem"
        initialAnswers={{ language: ['de', 'en'] }}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-lang-row-de')).toBeTruthy()
    })
    // Already-selected codes submit in their restored order without re-ticking.
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    expect(entry.answers.language).toEqual(['de', 'en'])
  })

  // DRAG-ORDER NOTE: reordering rows is driven by @dnd-kit pointer/touch/keyboard
  // sensors. @dnd-kit drag (including the KeyboardSensor's Space→Arrow→Space
  // sequence) does not fire reliably under jsdom — it depends on layout
  // rects / PointerEvent coordinates jsdom does not compute. Rather than fake a
  // dragEnd (which would test nothing real), the drag-REORDER path is covered
  // MANUALLY. The reorder LOGIC (moveItem splice + emit of selected-in-order) is
  // exercised indirectly by the initialAnswers test above (selection order is
  // preserved) and the multi-tick test (codes emit in display order).
})

// landr — the WHOLE checkbox chip must be a click target, not just the tiny
// checkmark. Clicking the chip container (not the inner Checkbox) toggles it.
describe('CustomFormStep — whole checkbox chip is clickable', () => {
  it('toggles when the chip container is clicked (not just the checkmark)', async () => {
    mocks.getProductFlow.mockResolvedValue({
      modules: [
        {
          kind: 'custom_form',
          position: 0,
          form: {
            key: 'consent_form',
            version: 1,
            name: 'Consent',
            name_localized: null,
            fields: [
              {
                key: 'agree',
                field_type: 'checkbox',
                label: 'I agree',
                label_localized: null,
                help_text: null,
                help_text_localized: null,
                required: true,
                position: 0,
                options: [
                  { value: 'yes', label: 'I agree', label_localized: null },
                ],
                validation: null,
                visibility_rule: null,
              },
            ],
          },
        },
      ],
    })
    const onConfirm = vi.fn()
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="consent_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('cf-option-agree-yes')).toBeTruthy()
    })
    // Click the chip CONTAINER (not cf-checkbox-…) — must still toggle.
    fireEvent.click(screen.getByTestId('cf-option-agree-yes'))
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    const entry = onConfirm.mock.calls[0][0] as { answers: Record<string, unknown> }
    expect(entry.answers.agree).toEqual(['yes'])
  })
})

// ─── landr-r6e5x.4: per-participant language assignment board ────────────────
//
// Epic decision D3 replaces the booking-level ranked multi-select with a
// room-assignment-style board: every party member (companions included) goes
// into exactly one offered-language column, and the step cannot be completed
// until the Unassigned tray is empty.
//
// Drag-and-drop itself is @dnd-kit's, and jsdom has no layout for a pointer
// drag to resolve against — so these exercise the two NON-drag modalities the
// component ships precisely so the interaction never depends on drag working:
// tap-to-place and the per-member <select>. Both write the same map the drag
// handler does.

function langBoardFlow(required = true) {
  return {
    modules: [
      {
        kind: 'custom_form' as const,
        position: 0,
        form: {
          key: 'lang_form',
          version: 1,
          name: 'Language',
          name_localized: null,
          fields: [
            {
              key: 'languages',
              field_type: 'language' as const,
              label: 'Guide language',
              label_localized: null,
              help_text: null,
              help_text_localized: null,
              required,
              position: 0,
              options: [
                { value: 'en', label: 'English', label_localized: null },
                { value: 'de', label: 'Deutsch', label_localized: null },
                { value: 'es', label: 'Español', label_localized: null },
              ],
              validation: null,
              visibility_rule: null,
            },
            {
              key: 'other_languages',
              field_type: 'text' as const,
              label: 'Other languages you speak',
              label_localized: null,
              help_text: null,
              help_text_localized: null,
              required: false,
              position: 1,
              options: null,
              validation: null,
              visibility_rule: null,
            },
          ],
        },
      },
    ],
  }
}

interface BoardRenderOptions {
  participantNames?: string[]
  guestFlags?: boolean[]
  offeredLanguages?: string[] | null
  initialParticipantLanguages?: Record<number, string>
  required?: boolean
}

function renderBoardStep(
  onConfirm = vi.fn(),
  {
    participantNames = ['Ada', 'Grace', 'Kay'],
    guestFlags = [false, false, true],
    offeredLanguages = ['en', 'de', 'es'],
    initialParticipantLanguages,
    required = true,
  }: BoardRenderOptions = {},
) {
  mocks.getProductFlow.mockResolvedValue(langBoardFlow(required))
  render(
    <CustomFormStep
      operatorToken="tok"
      productId="p1"
      formKey="lang_form"
      productName="Tandem"
      participantNames={participantNames}
      guestFlags={guestFlags}
      offeredLanguages={offeredLanguages}
      initialParticipantLanguages={initialParticipantLanguages}
      onBack={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

/** Assign via the always-available per-member <select> fallback. */
function assignViaSelect(memberIndex: number, code: string) {
  fireEvent.change(screen.getByTestId(`lang-assign-select-${memberIndex}`), {
    target: { value: code },
  })
}

describe('CustomFormStep — per-participant language board (landr-r6e5x.4)', () => {
  it('renders the board (not the ranked picker) with everyone unassigned and no columns open', async () => {
    renderBoardStep()

    await waitFor(() => {
      expect(screen.getByTestId('participant-language-board')).toBeTruthy()
    })
    // The ranked multi-select this replaces is gone.
    expect(screen.queryByTestId('cf-lang-row-en')).toBeNull()

    // Everyone starts in the tray — one chip per party member, companions included.
    expect(screen.getByTestId('lang-chip-0')).toBeTruthy()
    expect(screen.getByTestId('lang-chip-1')).toBeTruthy()
    expect(screen.getByTestId('lang-chip-2')).toBeTruthy()
    expect(screen.getByTestId('lang-chip-2').dataset.guest).toBe('true')
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Unassigned (3)',
    )

    // No column is open yet (decision D3) — only the "Add language" chips.
    expect(screen.queryByTestId('lang-column-en')).toBeNull()
    expect(screen.getByTestId('lang-add-en')).toBeTruthy()
    expect(screen.getByTestId('lang-add-de')).toBeTruthy()
    expect(screen.getByTestId('lang-add-es')).toBeTruthy()
  })

  it('opens a column from the Add-language row and closes it again while empty', async () => {
    renderBoardStep()
    await waitFor(() => expect(screen.getByTestId('lang-add-de')).toBeTruthy())

    fireEvent.click(screen.getByTestId('lang-add-de'))
    expect(screen.getByTestId('lang-column-de')).toBeTruthy()
    // Opening it takes it out of the "add" row.
    expect(screen.queryByTestId('lang-add-de')).toBeNull()

    fireEvent.click(screen.getByTestId('lang-remove-de'))
    expect(screen.queryByTestId('lang-column-de')).toBeNull()
    expect(screen.getByTestId('lang-add-de')).toBeTruthy()
  })

  it('moves a member from the tray into a column, and re-assigning moves them between columns', async () => {
    renderBoardStep()
    await waitFor(() => expect(screen.getByTestId('lang-chip-0')).toBeTruthy())

    assignViaSelect(0, 'de')
    // The column opens itself around an assigned member — a restored or
    // dropdown-driven assignment is never hidden behind a closed column.
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Unassigned (2)',
    )

    // Re-assign: Ada leaves German and lands in Spanish, in one move. The
    // German column stays put (now empty and removable) rather than vanishing
    // under the customer's cursor.
    assignViaSelect(0, 'es')
    expect(screen.getByTestId('lang-column-de').textContent).not.toContain('Ada')
    expect(screen.getByTestId('lang-remove-de')).toBeTruthy()
    expect(screen.getByTestId('lang-column-es').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Unassigned (2)',
    )
  })

  it('tap-to-place assigns without any drag, and tapping a placed chip returns them to the tray', async () => {
    renderBoardStep()
    await waitFor(() => expect(screen.getByTestId('lang-add-en')).toBeTruthy())
    fireEvent.click(screen.getByTestId('lang-add-en'))

    // Pick up Grace, then tap the English column.
    fireEvent.click(screen.getByTestId('lang-chip-1'))
    fireEvent.click(screen.getByTestId('lang-place-here-en'))
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Grace')

    // Tapping a placed chip is the "get me out of here" gesture.
    fireEvent.click(screen.getByTestId('lang-chip-1'))
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Grace',
    )
  })

  it('blocks Continue until every member — companions included — has a language', async () => {
    const onConfirm = renderBoardStep()
    await waitFor(() => expect(screen.getByTestId('cf-submit')).toBeTruthy())
    expect(screen.getByTestId('cf-submit')).toBeDisabled()

    assignViaSelect(0, 'en')
    assignViaSelect(1, 'en')
    // Two of three: still blocked, and the gate names who is missing.
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
    expect(screen.getByTestId('cf-language-board-incomplete').textContent).toContain(
      'Assign every participant to a language',
    )
    expect(screen.getByTestId('cf-language-board-incomplete').textContent).toContain(
      'Kay',
    )

    // The companion counts too — assigning them clears the gate.
    assignViaSelect(2, 'de')
    await waitFor(() => expect(screen.getByTestId('cf-submit')).toBeEnabled())
    expect(screen.queryByTestId('cf-language-board-incomplete')).toBeNull()
    expect(screen.getByTestId('lang-everyone-assigned')).toBeTruthy()

    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })

  it('reports the party-index → language map and mirrors the distinct set, booker first, into the form answer', async () => {
    const onConfirm = renderBoardStep()
    await waitFor(() => expect(screen.getByTestId('cf-submit')).toBeTruthy())

    // Booker (index 0) speaks Spanish; the other two German — so the mirrored
    // list must lead with 'es' (the backend reads entry 0 as the preferred
    // language for the confirmation email's locale).
    assignViaSelect(0, 'es')
    assignViaSelect(1, 'de')
    assignViaSelect(2, 'de')
    await waitFor(() => expect(screen.getByTestId('cf-submit')).toBeEnabled())
    fireEvent.click(screen.getByTestId('cf-submit'))

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const [entry, , assignment] = onConfirm.mock.calls[0] as [
      { answers: Record<string, unknown> },
      Record<string, unknown>,
      Record<number, string>,
    ]
    expect(assignment).toEqual({ 0: 'es', 1: 'de', 2: 'de' })
    expect(entry.answers.languages).toEqual(['es', 'de'])
  })

  it('restores a draft assignment on back-nav re-entry, columns and all', async () => {
    renderBoardStep(vi.fn(), {
      initialParticipantLanguages: { 0: 'en', 1: 'en', 2: 'es' },
    })
    await waitFor(() =>
      expect(screen.getByTestId('participant-language-board')).toBeTruthy(),
    )
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Grace')
    expect(screen.getByTestId('lang-column-es').textContent).toContain('Kay')
    expect(screen.getByTestId('cf-submit')).toBeEnabled()
  })

  it('drops a restored assignment to a language the operator has since withdrawn', async () => {
    // The operator edited Settings (landr-r6e5x.3) while the customer had the
    // tab open: Kay's Spanish is gone, so Kay is unassigned and the step blocks.
    renderBoardStep(vi.fn(), {
      offeredLanguages: ['en', 'de'],
      initialParticipantLanguages: { 0: 'en', 1: 'en', 2: 'es' },
    })
    await waitFor(() =>
      expect(screen.getByTestId('participant-language-board')).toBeTruthy(),
    )
    expect(screen.queryByTestId('lang-column-es')).toBeNull()
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain('Kay')
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
  })

  it('uses the operator offered list over the form field options, and the options when the operator list is absent', async () => {
    // Operator column wins: 'fr' appears even though the form def predates it,
    // and the form's stale 'es' option does not.
    const { unmount } = render(<div />)
    unmount()
    renderBoardStep(vi.fn(), { offeredLanguages: ['en', 'fr'] })
    await waitFor(() => expect(screen.getByTestId('lang-add-fr')).toBeTruthy())
    expect(screen.queryByTestId('lang-add-es')).toBeNull()
    // A language only the operator column knows about is still submittable —
    // a stale form option list must not reject it as "an invalid option".
    assignViaSelect(0, 'fr')
    expect(screen.getByTestId('lang-column-fr').textContent).toContain('Ada')
  })

  it('falls back to the form field options when the operator config carries no offered list', async () => {
    renderBoardStep(vi.fn(), { offeredLanguages: null })
    await waitFor(() => expect(screen.getByTestId('lang-add-en')).toBeTruthy())
    expect(screen.getByTestId('lang-add-de')).toBeTruthy()
    expect(screen.getByTestId('lang-add-es')).toBeTruthy()
  })

  it('keeps the ranked multi-select when no party roster is supplied', async () => {
    // Standalone/legacy callers (and any operator flow reached before the
    // roster exists) must not hit an empty, unusable board.
    mocks.getProductFlow.mockResolvedValue(langBoardFlow())
    render(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="lang_form"
        productName="Tandem"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('cf-lang-row-en')).toBeTruthy())
    expect(screen.queryByTestId('participant-language-board')).toBeNull()
  })

  it('says the free-text field does not assign anyone', async () => {
    renderBoardStep()
    await waitFor(() =>
      expect(screen.getByTestId('participant-language-board')).toBeTruthy(),
    )
    expect(screen.getByTestId('cf-field-languages').textContent).toContain(
      "they don't assign anyone",
    )
    // …and the free-text field itself is untouched, still below the board.
    expect(screen.getByTestId('cf-field-other_languages')).toBeTruthy()
  })
})
