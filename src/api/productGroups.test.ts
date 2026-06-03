/**
 * Tests for landr-d8rg contract D+E client-side types, client fn, and mock
 * shape consistency. Gates that downstream UI slices depend on:
 *   - listProductGroups fetches the right URL and handles errors (contract E)
 *   - every mock product's group_slug exists in mock groups
 *   - product_count in each group is consistent with bookable mock products
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as client from './client'
import { mockProductGroups, mockProducts } from './mocks'

describe('listProductGroups — mock mode (landr-d8rg contract E)', () => {
  it('returns 4 groups in mock mode', async () => {
    const groups = await client.listProductGroups('para42')
    expect(groups).toHaveLength(4)
  })

  it('each group has required fields of correct types', async () => {
    const groups = await client.listProductGroups('para42')
    for (const g of groups) {
      expect(typeof g.id).toBe('string')
      expect(typeof g.slug).toBe('string')
      expect(typeof g.name).toBe('string')
      expect(typeof g.sort_order).toBe('number')
      expect(typeof g.product_count).toBe('number')
      // image_url is string|null
      expect(g.image_url === null || typeof g.image_url === 'string').toBe(true)
      // parent_id is string|null
      expect(g.parent_id === null || typeof g.parent_id === 'string').toBe(true)
      // localized fields are Record<string,string>|null
      expect(g.name_localized === null || typeof g.name_localized === 'object').toBe(true)
      expect(g.description === null || typeof g.description === 'string').toBe(true)
      expect(g.description_localized === null || typeof g.description_localized === 'object').toBe(true)
    }
  })

  it('includes the 4 expected German paragliding groups by slug', async () => {
    const groups = await client.listProductGroups('para42')
    const slugs = groups.map((g) => g.slug)
    expect(slugs).toContain('tandemfluege')
    expect(slugs).toContain('kurse')
    expect(slugs).toContain('reisen')
    expect(slugs).toContain('verleih')
  })

  it('at least one group has a null image_url (exercises no-cover-photo path)', async () => {
    const groups = await client.listProductGroups('para42')
    const noImage = groups.filter((g) => g.image_url === null)
    expect(noImage.length).toBeGreaterThan(0)
  })
})

describe('listProductGroups — fetch path (landr-d8rg contract E)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('calls GET /api/public/operators/{token}/product-groups', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    await client.listProductGroups('tok-abc')
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toBe('https://api.example.com/api/public/operators/tok-abc/product-groups')
  })

  it('appends preview_token query param when provided', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    await client.listProductGroups('tok-abc', { previewToken: 'prev-xyz' })
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('preview_token=prev-xyz')
  })

  it('omits preview_token param when not provided', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    await client.listProductGroups('tok-abc')
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).not.toContain('preview_token')
  })

  it('throws HttpError on non-2xx response', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404, statusText: 'Not Found' }),
    )
    await expect(client.listProductGroups('bad-token')).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    })
  })
})

// Mock-shape consistency tests use the mock helpers directly to avoid
// environment stub ordering issues — these tests are about data shape,
// not the client's env-branching logic.

describe('mock shape consistency — group slugs (landr-d8rg contract D+E)', () => {
  it('every mock product group_slug (when set) exists in the mock groups list', () => {
    const products = mockProducts()
    const groups = mockProductGroups('para42')
    const groupSlugs = new Set(groups.map((g) => g.slug))

    for (const p of products) {
      if (p.group_slug !== null) {
        expect(groupSlugs.has(p.group_slug)).toBe(true)
      }
    }
  })

  it('product_count for tandemfluege matches bookable tandemfluege products', () => {
    const products = mockProducts()
    const groups = mockProductGroups('para42')

    const tandemGroup = groups.find((g) => g.slug === 'tandemfluege')
    expect(tandemGroup).toBeDefined()

    const bookableInGroup = products.filter(
      (p) => p.group_slug === 'tandemfluege' && p.bookable !== false,
    )
    expect(tandemGroup!.product_count).toBe(bookableInGroup.length)
  })
})

describe('mock shape consistency — new Product fields (landr-d8rg contract D)', () => {
  it('every mock product has thumb_url (string|null) and images (array)', () => {
    const products = mockProducts()
    for (const p of products) {
      expect(p.thumb_url === null || typeof p.thumb_url === 'string').toBe(true)
      expect(Array.isArray(p.images)).toBe(true)
    }
  })

  it('every mock product has price_from (string|null)', () => {
    const products = mockProducts()
    for (const p of products) {
      expect(p.price_from === null || typeof p.price_from === 'string').toBe(true)
    }
  })

  it('at least one product has price_from: null (exercises hidden-"from" path)', () => {
    const products = mockProducts()
    const noPrice = products.filter((p) => p.price_from === null)
    expect(noPrice.length).toBeGreaterThan(0)
  })

  it('at least two products have non-empty images array', () => {
    const products = mockProducts()
    const withImages = products.filter((p) => p.images.length > 0)
    expect(withImages.length).toBeGreaterThanOrEqual(2)
  })

  it('each ProductImage in images[] has thumb_url, hero_url (string) and alt (string|null)', () => {
    const products = mockProducts()
    for (const p of products) {
      for (const img of p.images) {
        expect(typeof img.thumb_url).toBe('string')
        expect(typeof img.hero_url).toBe('string')
        expect(img.alt === null || typeof img.alt === 'string').toBe(true)
      }
    }
  })

  it('product with images has thumb_url matching the first image thumb_url', () => {
    const products = mockProducts()
    const withImages = products.filter((p) => p.images.length > 0)
    expect(withImages.length).toBeGreaterThan(0)
    for (const p of withImages) {
      expect(p.thumb_url).toBe(p.images[0]!.thumb_url)
    }
  })
})
