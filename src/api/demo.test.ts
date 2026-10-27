import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estimateBookingPrice,
  getAvailability,
  getFixedDateWindows,
  getOperatorSettings,
  getPassTiers,
  initiatePayment,
  initiateSubscriptionCheckout,
  listProductGroups,
  listProducts,
  requestPassMemberProof,
  requestSubscriptionPerkOtp,
  submitBooking,
  submitGroupInquiry,
  submitStaffBooking,
  acceptOffer,
  putBookingDetails,
  cancelBooking,
} from './client'
import { DemoWriteBlockedError, demoProducts, demoSettings, resetDemoTemplateCache } from './demo'
import { DEMO_LANGS, demoCopy, demoLang, demoSignupUrl, demoSlug } from '@/lib/demo'
import { browserLocale } from '@/lib/locale'
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

// landr-m6tp4.46: the stay / pass / verified-registration templates.
const bare = {
  name_localized: null, short_description: null, short_description_localized: null, description: null,
  is_contiguous: false, duration_minutes: null, group_slug: null, group_name: null, sort_order: 1,
  currency: 'EUR', price_notes: [], images: [], thumb_url: null, guide_languages: null,
  requires_verification: false, daily_cap: null, waiver_text_localized: null, pass_tiers: null,
}
const STAY_CATALOGUE = {
  template_slug: 'apartment', version: 1, groups: [],
  products: [
    {
      ...bare, slug: 'studio', name: 'Studio', product_kind: 'stay', service_time_shape: null,
      price_per_unit: 85, price_from: '85.00', price_base: '85.00',
      stay: { min_nights: 2, max_nights: 28, cleaning_fee_cents: 4000, check_in_time: '15:00', check_out_time: '11:00', sleeps: 2 },
    },
  ],
}
const PASS_CATALOGUE = {
  template_slug: 'site_day_pass', version: 1, groups: [],
  products: [
    {
      ...bare, slug: 'site-pass', name: 'Flying-site pass', product_kind: 'pass', service_time_shape: null,
      price_per_unit: 8, price_from: '12.00', price_base: '12.00',
      pass_tiers: [
        { label: 'Day', validity_kind: 'day', validity_days: null, season_start: null, season_end: null, price_cents: 1200, member_price_cents: 900 },
        { label: '3 days', validity_kind: 'days', validity_days: 3, season_start: null, season_end: null, price_cents: 3000, member_price_cents: null },
        { label: 'Season', validity_kind: 'season', validity_days: null, season_start: '2027-03-01', season_end: '2027-10-31', price_cents: 18000, member_price_cents: 13000 },
      ],
    },
    {
      ...bare, slug: 'other-pass', name: 'Camper pass', product_kind: 'pass', service_time_shape: null,
      price_per_unit: 15, price_from: '15.00', price_base: '15.00',
      pass_tiers: [
        { label: 'Day', validity_kind: 'day', validity_days: null, season_start: null, season_end: null, price_cents: 1500, member_price_cents: null },
      ],
    },
  ],
}

let fetchMock: ReturnType<typeof vi.fn>
let catalogueStatus = 200
let catalogue: unknown = CATALOGUE

beforeEach(() => {
  resetDemoTemplateCache()
  catalogueStatus = 200
  catalogue = CATALOGUE
  fetchMock = vi.fn(async (url: string) =>
    String(url).endsWith('/catalogue')
      ? new Response(JSON.stringify(catalogue), { status: catalogueStatus })
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
    for (const l of ['es', 'it', 'tr'] as const) {
      expect(demoSignupUrl('kayak', l)).toBe(`https://www.landr.de/${l}/signup/?template=kayak`)
    }
  })

  it('demoLang supports en/de/es/it/tr and falls back to en (fr, junk)', () => {
    const at = (q: string) => {
      window.history.replaceState({}, '', `/?demo=kayak${q}`)
      return demoLang()
    }
    expect(at('')).toBe('en')
    expect(at('&lang=de')).toBe('de')
    expect(at('&lang=es')).toBe('es')
    expect(at('&lang=IT')).toBe('it')
    expect(at('&lang=tr-TR')).toBe('tr')
    expect(at('&lang=fr')).toBe('en')
    expect(at('&lang=xx')).toBe('en')
  })

  it('every language has a non-empty, distinct-from-English demoCopy for every key', () => {
    const en = demoCopy('en')
    for (const l of DEMO_LANGS) {
      const c = demoCopy(l)
      expect(Object.keys(c).sort()).toEqual(Object.keys(en).sort())
      for (const v of Object.values(c)) expect(v.trim().length).toBeGreaterThan(0)
      if (l !== 'en') {
        expect(c.banner).not.toBe(en.banner)
        expect(c.congratsTitle).not.toBe(en.congratsTitle)
        expect(c.congratsBody).not.toBe(en.congratsBody)
        expect(c.cta).not.toBe(en.cta)
        expect(c.again).not.toBe(en.again)
      }
    }
  })

  it('browserLocale follows ?lang= in demo mode, ignoring the browser', () => {
    window.history.replaceState({}, '', '/?demo=kayak&lang=es')
    expect(browserLocale()).toBe('es')
    window.history.replaceState({}, '', '/?demo=kayak&lang=fr')
    expect(browserLocale()).toBe('en')
  })

  it('settings headline picks pitch[lang] then falls back to en', () => {
    const tpl = {
      slug: 'kayak',
      pitch: { en: { headline: 'EN head' }, es: { headline: 'ES head' }, it: { headline: '' } },
    }
    window.history.replaceState({}, '', '/?demo=kayak&lang=es')
    expect(demoSettings(tpl).name).toBe('ES head')
    expect(demoSettings(tpl).default_locale).toBe('es')
    window.history.replaceState({}, '', '/?demo=kayak&lang=it')
    expect(demoSettings(tpl).name).toBe('EN head')
    window.history.replaceState({}, '', '/?demo=kayak&lang=tr')
    expect(demoSettings(tpl).name).toBe('EN head')
  })

  it('sample offers and roles are localized', () => {
    const p = demoProducts({ slug: 'kayak' })
    for (const l of ['de', 'es', 'it', 'tr']) {
      expect(p[0].name_localized?.[l]).toBeTruthy()
      expect(p[0].name_localized?.[l]).not.toBe(p[0].name)
    }
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

describe('demo mode: stay, pass and verification templates (landr-m6tp4.46)', () => {
  const stayEstimate = async (nights: string[], guests = 2) => {
    catalogue = STAY_CATALOGUE
    window.history.replaceState({}, '', '/?demo=apartment')
    resetDemoTemplateCache()
    const [studio] = await listProducts('demo-apartment')
    return {
      studio,
      est: await estimateBookingPrice('demo-apartment', studio.product_id, {
        selected_days: nights,
        participants_count: guests,
        addon_lines: [],
      }),
    }
  }
  const FUTURE = ['2099-03-01', '2099-03-02', '2099-03-03']

  it('quotes a stay as nights x nightly rate plus the cleaning fee once, with the window', async () => {
    const { studio, est } = await stayEstimate(FUTURE)
    expect(studio.stay).toMatchObject({ min_nights: 2, sleeps: 2, cleaning_fee_cents: 4000 })
    expect(est.line_items).toHaveLength(1)
    expect(est.line_items[0]).toMatchObject({ qty: 1, units: 3, unit_price: '85.00', cleaning_fee: '40.00', line_total: '295.00' })
    expect(est.grand_total).toBe('295.00')
    expect(est.stay).toEqual({
      check_in: '2099-03-01', check_out: '2099-03-04', nights: 3, cleaning_fee: '40.00', errors: [],
    })
  })

  it('reports the stay rules a range breaks, so checkout is blocked as in production', async () => {
    const short = await stayEstimate(['2099-03-01'])
    expect(short.est.stay?.errors).toEqual([{ code: 'below_min_nights' }])
    const crowded = await stayEstimate(FUTURE, 3)
    expect(crowded.est.stay?.errors).toEqual([{ code: 'too_many_guests' }])
    const past = await stayEstimate(['2020-03-01', '2020-03-02'])
    expect(past.est.stay?.errors).toEqual([{ code: 'check_in_past', date: '2020-03-01' }])
  })

  it('opens every night of a stay for the range picker', async () => {
    const { studio } = await stayEstimate(FUTURE)
    const nights = await getAvailability(studio.product_id, '2099-03-01', '2099-03-05')
    expect(nights.map((n) => n.date)).toEqual(['2099-03-01', '2099-03-02', '2099-03-03', '2099-03-04', '2099-03-05'])
    expect(nights.every((n) => n.status === 'open' && n.available_seats >= 1)).toBe(true)
  })

  it('offers an event product only on its next occurrences', async () => {
    catalogue = {
      template_slug: 'testival', version: 2, groups: [],
      products: [
        {
          ...bare, slug: 'testival-weekend', name: 'Testival weekend', product_kind: 'service',
          service_time_shape: 'days_range', price_per_unit: 0, price_from: '0.00', price_base: '0.00',
          event_window: {
            start_weekday: 4, end_weekday: 7, cutoff_hours: null, horizon_n: 2,
            occurrences: [
              { start_date: '2099-03-05', end_date: '2099-03-08' },
              { start_date: '2099-03-12', end_date: '2099-03-15' },
            ],
          },
        },
        {
          ...bare, slug: 'plain-day', name: 'Plain day', product_kind: 'service',
          service_time_shape: 'single_date', price_per_unit: 5, price_from: '5.00', price_base: '5.00',
        },
      ],
    }
    window.history.replaceState({}, '', '/?demo=testival')
    resetDemoTemplateCache()
    const [weekend, plain] = await listProducts('demo-testival')
    const days = await getAvailability(weekend.product_id, '2099-03-01', '2099-03-20')
    expect(days.map((d) => d.date)).toEqual([
      '2099-03-05', '2099-03-06', '2099-03-07', '2099-03-08',
      '2099-03-12', '2099-03-13', '2099-03-14', '2099-03-15',
    ])
    // a product without a window stays open every day
    expect(await getAvailability(plain.product_id, '2099-03-01', '2099-03-03')).toHaveLength(3)
  })

  it("answers a pass product's tiers from the template, guest prices first", async () => {
    catalogue = PASS_CATALOGUE
    window.history.replaceState({}, '', '/?demo=site_day_pass')
    resetDemoTemplateCache()
    const [site, camper] = await listProducts('demo-site_day_pass')
    expect(site).not.toHaveProperty('pass_tiers')
    const res = await getPassTiers('demo-site_day_pass', site.product_id)
    expect(res).toMatchObject({ product_id: site.product_id, currency: 'EUR', is_member: false })
    expect(res.tiers.map((t) => [t.label, t.validity_kind, t.unit_price_cents, t.has_member_price, t.member_price_cents])).toEqual([
      ['Day', 'day', 1200, true, null],
      ['3 days', 'days', 3000, false, null],
      ['Season', 'season', 18000, true, null],
    ])
    expect(res.tiers[1].validity_days).toBe(3)
    expect(res.tiers[2]).toMatchObject({ season_start: '2027-03-01', season_end: '2027-10-31' })
    expect(new Set(res.tiers.map((t) => t.id)).size).toBe(3)
    expect((await getPassTiers('demo-site_day_pass', camper.product_id)).tiers).toHaveLength(1)
  })

  it('shows member prices after the pretend member code, without any network call', async () => {
    catalogue = PASS_CATALOGUE
    window.history.replaceState({}, '', '/?demo=site_day_pass')
    resetDemoTemplateCache()
    const [site] = await listProducts('demo-site_day_pass')
    await requestSubscriptionPerkOtp('demo-site_day_pass', 'ada@example.com')
    const proof = await requestPassMemberProof('demo-site_day_pass', 'ada@example.com', '123456')
    const res = await getPassTiers('demo-site_day_pass', site.product_id, {
      email: 'ada@example.com', memberProof: proof.member_proof,
    })
    expect(res.is_member).toBe(true)
    expect(res.tiers.map((t) => t.unit_price_cents)).toEqual([900, 3000, 13000])
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\/api\/public\/templates\/site_day_pass(\/catalogue)?$/)
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })

  it('answers no tiers for a product that is not a pass', async () => {
    const [full] = await listProducts('demo-kayak')
    expect((await getPassTiers('demo-kayak', full.product_id)).tiers).toEqual([])
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

describe('demoArt', () => {
  it('gives known template products three comic images', async () => {
    const { demoArt } = await import('./demo')
    const imgs = demoArt('kayak', 'half-day-tour', 'Half-day tour')
    expect(imgs).toHaveLength(3)
    expect(imgs[0].hero_url).toMatch(/demo\/kayak\/half-day-tour-1\.svg$/)
  })

  it('gives unknown products none', async () => {
    const { demoArt } = await import('./demo')
    expect(demoArt('kayak', 'nope', 'x')).toEqual([])
  })
})
