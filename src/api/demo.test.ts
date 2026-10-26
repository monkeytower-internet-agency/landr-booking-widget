import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estimateBookingPrice,
  getAvailability,
  getFixedDateWindows,
  getOperatorSettings,
  initiatePayment,
  initiateSubscriptionCheckout,
  listProductGroups,
  listProducts,
  submitBooking,
  submitGroupInquiry,
  submitStaffBooking,
  acceptOffer,
  putBookingDetails,
  cancelBooking,
} from './client'
import { DemoWriteBlockedError, resetDemoTemplateCache } from './demo'
import { demoSignupUrl, demoSlug } from '@/lib/demo'
import type { SubmitBookingBody } from './types'

const TEMPLATE = {
  slug: 'kayak',
  version: 1,
  flow: 'solo',
  product_count: 3,
  uses_pools: false,
  onboarding_preset_key: null,
  pitch: { en: { headline: 'Paddle for a living', hero_url: 'https://cdn.example/h.jpg' } },
}

// The template operator's real catalogue (slug-keyed, no ids).
const CATALOGUE = {
  template_slug: 'kayak',
  version: 1,
  groups: [
    {
      slug: 'tours', name: 'Tours', name_localized: { de: 'Touren' }, description: null,
      description_localized: null, image_url: null, sort_order: 1, parent_slug: null,
      product_count: 2, bookable_count: 2,
    },
  ],
  products: [
    {
      slug: 'sunset-tour', name: 'Sunset tour with {company}', name_localized: { de: 'Sonnenuntergangstour' },
      short_description: 'Paddle at dusk', short_description_localized: { de: 'Paddeln in der Dämmerung' },
      description: null, product_kind: 'service', service_time_shape: 'days_range', is_contiguous: true,
      duration_minutes: null, group_slug: 'tours', group_name: 'Tours', sort_order: 1,
      price_per_unit: 70, currency: 'EUR', price_from: '65.00', price_base: '70.00', price_notes: [],
      images: [{ thumb_url: 'https://img.example/t.jpg', hero_url: 'https://img.example/h.jpg', alt: 'x' }],
      thumb_url: 'https://img.example/t.jpg', guide_languages: ['en', 'de'],
    },
    {
      slug: 'lagoon-rental', name: 'Lagoon rental', name_localized: null, short_description: null,
      short_description_localized: null, description: null, product_kind: 'service',
      service_time_shape: 'time_slot', is_contiguous: false, duration_minutes: 90, group_slug: 'tours',
      group_name: 'Tours', sort_order: 2, price_per_unit: 20, currency: 'EUR', price_from: '20.00',
      price_base: '20.00', price_notes: [], images: [], thumb_url: null, guide_languages: null,
    },
  ],
}

let fetchMock: ReturnType<typeof vi.fn>
let catalogueStatus = 200

beforeEach(() => {
  resetDemoTemplateCache()
  catalogueStatus = 200
  fetchMock = vi.fn(async (url: string) =>
    String(url).endsWith('/catalogue')
      ? new Response(JSON.stringify(CATALOGUE), { status: catalogueStatus })
      : new Response(JSON.stringify(TEMPLATE), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState({}, '', '/?demo=kayak')
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
  delete document.documentElement.dataset.demo
})

describe('demo slug', () => {
  it('reads ?demo= and data-demo, rejects junk', () => {
    expect(demoSlug()).toBe('kayak')
    window.history.replaceState({}, '', '/?demo=../../x')
    expect(demoSlug()).toBeNull()
    window.history.replaceState({}, '', '/')
    document.documentElement.dataset.demo = 'course'
    expect(demoSlug()).toBe('course')
  })

  it('signup link carries the template slug', () => {
    expect(demoSignupUrl('kayak', 'de')).toBe('https://www.landr.de/de/signup/?template=kayak')
    expect(demoSignupUrl('kayak', 'en')).toBe('https://www.landr.de/signup/?template=kayak')
  })
})

describe('demo mode reads', () => {
  it("serves the template's real catalogue and groups, with synthetic ids", async () => {
    const products = await listProducts('demo-kayak')
    expect(products.map((p) => p.name)).toEqual(['Sunset tour with your company', 'Lagoon rental'])
    expect(products[0].name_localized?.de).toBe('Sonnenuntergangstour')
    expect(products[0].thumb_url).toBe('https://img.example/t.jpg')
    expect(products[0].product_id).toBe('demo-kayak-sunset-tour')
    expect(products[0].product_group_id).toBe('demo-kayak-group-tours')
    expect(products.every((p) => p.bookable && p.is_publicly_listed)).toBe(true)
    const groups = await listProductGroups('demo-kayak')
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: 'demo-kayak-group-tours', slug: 'tours', parent_id: null, product_count: 2 })
    const settings = await getOperatorSettings('demo-kayak')
    expect(settings.name).toBe('Paddle for a living')
  })

  it('falls back to the sample offers when the catalogue request fails', async () => {
    catalogueStatus = 500
    resetDemoTemplateCache()
    const products = await listProducts('demo-kayak')
    expect(products.map((p) => p.name)).toEqual(['Full-day tour', 'Half-day tour', 'Rental'])
    expect(products[0].thumb_url).toBe('https://cdn.example/h.jpg')
    expect(await listProductGroups('demo-kayak')).toEqual([])
  })

  it('falls back to a generic catalogue when the template lookup fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    resetDemoTemplateCache()
    window.history.replaceState({}, '', '/?demo=newthing')
    const products = await listProducts('demo-newthing')
    expect(products).toHaveLength(1)
  })

  it('generates always-available slots, timed for time_slot products', async () => {
    const [, rental] = await listProducts('demo-kayak')
    const slots = await getAvailability(rental.product_id, '2027-03-01', '2027-03-03')
    expect(slots).toHaveLength(6)
    expect(slots.every((s) => s.status === 'open' && s.available_seats > 0 && s.start_time)).toBe(true)
    expect((await getFixedDateWindows(rental.product_id)).length).toBeGreaterThan(0)
  })

  it('prices locally', async () => {
    const [full] = await listProducts('demo-kayak')
    const est = await estimateBookingPrice('demo-kayak', full.product_id, {
      selected_days: ['2027-03-01', '2027-03-02'],
      participants_count: 2,
      addon_lines: [],
    })
    expect(est.grand_total).toBe('260.00')
    expect(est.un_priceable).toBe(false)
  })
})

describe('demo mode never writes', () => {
  it('only ever GETs the public template and its catalogue; no booking/payment endpoint is called', async () => {
    const [full] = await listProducts('demo-kayak')
    await getAvailability(full.product_id, '2027-03-01', '2027-03-02')
    await estimateBookingPrice('demo-kayak', full.product_id, {
      selected_days: ['2027-03-01'],
      participants_count: 1,
      addon_lines: [],
    })
    const res = await submitBooking({} as SubmitBookingBody)
    expect(res.booking_id).toBe('demo-booking')

    const writes: Array<() => Promise<unknown>> = [
      () => submitStaffBooking('op', {} as never),
      () => initiatePayment({} as never),
      () => initiateSubscriptionCheckout({} as never),
      () => submitGroupInquiry('demo-kayak', {} as never),
      () => acceptOffer('t'),
      () => putBookingDetails('t', {} as never),
      () => cancelBooking('t'),
    ]
    for (const w of writes) await expect(w()).rejects.toBeInstanceOf(DemoWriteBlockedError)

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\/api\/public\/templates\/kayak(\/catalogue)?$/)
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })
})
