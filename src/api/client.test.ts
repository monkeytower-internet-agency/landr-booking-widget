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
