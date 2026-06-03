import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VariantProvider } from './variant.tsx'
import { useVariant, VARIANT_TOKENS } from './variant'

function Probe() {
  const { variant, tokens } = useVariant()
  return <div data-testid="probe" data-variant={variant} data-radius={tokens.cardRadius} />
}

describe('VariantProvider / useVariant (landr-d8rg.3)', () => {
  it('defaults to aurora tokens with no provider mounted', () => {
    render(<Probe />)
    const el = screen.getByTestId('probe')
    expect(el.dataset.variant).toBe('aurora')
    expect(el.dataset.radius).toBe(VARIANT_TOKENS.aurora.cardRadius)
  })

  it('exposes the explicit provider value + resolved tokens', () => {
    render(
      <VariantProvider value="alpine">
        <Probe />
      </VariantProvider>,
    )
    const el = screen.getByTestId('probe')
    expect(el.dataset.variant).toBe('alpine')
    expect(el.dataset.radius).toBe(VARIANT_TOKENS.alpine.cardRadius)
  })
})
