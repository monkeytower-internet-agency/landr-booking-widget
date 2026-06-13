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

  it('shows a required error on submit when the required field is empty', async () => {
    renderStep()
    await waitFor(() => {
      expect(screen.getByTestId('cf-submit')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('cf-error-full_name')).toBeTruthy()
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

  it('shows a validation error when number is below min', async () => {
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
    fireEvent.change(screen.getByTestId('cf-field-weight_kg'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('cf-error-weight_kg')).toBeTruthy()
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
