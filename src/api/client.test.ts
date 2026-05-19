import { describe, it, expect, vi, afterEach } from 'vitest'
import * as client from './client'

describe('listProducts with mocks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all products when no group is specified', async () => {
    const products = await client.listProducts('para42')
    expect(products.length).toBeGreaterThan(0)
  })

  it('respects group filter in mock mode', async () => {
    const allProducts = await client.listProducts('para42')
    const coursesProducts = await client.listProducts('para42', { group: 'courses' })
    expect(coursesProducts.length).toBeLessThanOrEqual(allProducts.length)
  })
})

describe('getOperatorSettings with mocks (landr-e10.9)', () => {
  it('returns the operator slug and the safe default (false) for unknown operators', async () => {
    const settings = await client.getOperatorSettings('para42')
    expect(settings.slug).toBe('para42')
    expect(settings.expose_seats_to_customer).toBe(false)
  })
})
