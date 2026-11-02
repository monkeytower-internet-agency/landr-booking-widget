import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estimateBookingPrice,
  getOffers,
  getProductAlternatives,
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
import { DemoWriteBlockedError, demoAdjustments, demoProducts, demoSettings, resetDemoTemplateCache } from './demo'
import { DEMO_LANGS, demoCompanion, demoCopy, demoCustomer, demoLang, demoSignupUrl, demoSlug } from '@/lib/demo'
import { browserLocale } from '@/lib/locale'
import type { SubmitBookingBody } from './types'

/** The offers the evaluate call shows on a product's own line. */
async function offersOf(productId: string) {
  const res = await getOffers({
    widget_token: 'demo',
    lines: [{ line_id: 'main', product_id: productId }],
    guests: [],
  })
  return res.lines[0]!.offers ?? []
}

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
      description_localized: { en: 'Write to {email}', de: 'Schreib an {email}', es: 'Escribe a {email}', tr: 'Şuraya yaz: {email}' },
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
    // the long text keeps every language and fills the clone placeholders per language
    expect(products[0].description_localized).toEqual({
      en: 'Write to your email', de: 'Schreib an deine E-Mail', es: 'Escribe a tu correo electrónico', tr: 'Şuraya yaz: e-posta adresin',
    })
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

  it('scopes the product list to the picked category in demo mode', async () => {
    const all = await listProducts('demo-kayak')
    expect(all.length).toBeGreaterThan(0)
    const tours = await listProducts('demo-kayak', { group: 'tours' })
    expect(tours.every((p) => p.group_slug === 'tours')).toBe(true)
    expect(tours.length).toBe(all.filter((p) => p.group_slug === 'tours').length)
    expect(await listProducts('demo-kayak', { group: 'no-such-group' })).toEqual([])
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

  it('adds the weekend surcharge for Fri/Sat nights of a stay', async () => {
    const weekendRule = {
      rule_kind: 'weekday_adjustment', sort_order: 30,
      params: { weekdays: [5, 6], adjustment: 10, adjustment_type: 'percent' },
    }
    const base = STAY_CATALOGUE.products[0]!
    catalogue = {
      ...STAY_CATALOGUE,
      products: [{ ...base, pricing: { currency: 'EUR', rules: [weekendRule] } }],
    }
    window.history.replaceState({}, '', '/?demo=apartment')
    resetDemoTemplateCache()
    const [studio] = await listProducts('demo-apartment')
    // 2099-03-06 = Fri, 03-07 = Sat, 03-08 = Sun: two weekend nights of three.
    const est = await estimateBookingPrice('demo-apartment', studio.product_id, {
      selected_days: ['2099-03-06', '2099-03-07', '2099-03-08'], participants_count: 2, addon_lines: [],
    })
    // 3 x 85 = 255, +10% x 2/3 = 17.00, + 40 cleaning = 312.00
    expect(est.grand_total).toBe('312.00')
    expect(est.surcharges?.[0]).toMatchObject({ amount: '17.00' })
  })

  describe('city bike companion add-on', () => {
    const bikeStay = (extra: Record<string, unknown> = {}) => {
      const base = STAY_CATALOGUE.products[0]!
      catalogue = {
        ...STAY_CATALOGUE,
        products: [{
          ...base,
          addons: [{
            slug: 'bike-rental', name: 'City bike', paid_to: 'operator', price_unit: 'night',
            addon_quantity_rule: 'any', price_per_unit: 12, currency: 'EUR', day_selection: 'parent_subset',
            sort_order: 1, ...extra,
          }],
        }],
      }
      window.history.replaceState({}, '', '/?demo=apartment')
      resetDemoTemplateCache()
    }
    const NIGHTS = ['2099-03-09', '2099-03-10', '2099-03-11', '2099-03-12']

    it('prices a picked-days bike on its own nights, not the stay nights', async () => {
      bikeStay()
      const [studio] = await listProducts('demo-apartment')
      const [bike] = await offersOf(studio.product_id)
      const est = await estimateBookingPrice('demo-apartment', studio.product_id, {
        selected_days: NIGHTS,
        participants_count: 3,
        addon_lines: [{ product_id: bike.product_id, qty: 3, selected_days: ['2099-03-10', '2099-03-12'] }],
      })
      const line = est.line_items.find((l) => l.product_id === bike.product_id)!
      // 3 bikes x 2 picked nights x 12 EUR, not 3 x 4 stay nights.
      expect(line).toMatchObject({ qty: 3, units: 2, line_total: '72.00' })
    })

    it('still follows the stay nights when the line carries no days of its own', async () => {
      bikeStay()
      const [studio] = await listProducts('demo-apartment')
      const [bike] = await offersOf(studio.product_id)
      const est = await estimateBookingPrice('demo-apartment', studio.product_id, {
        selected_days: NIGHTS,
        participants_count: 3,
        addon_lines: [{ product_id: bike.product_id, qty: 3 }],
      })
      expect(est.line_items.find((l) => l.product_id === bike.product_id)).toMatchObject({ units: 4, line_total: '144.00' })
    })

    it('offers the bike as a day-pickable, free-quantity offer', async () => {
      bikeStay()
      const [studio] = await listProducts('demo-apartment')
      const [bike] = await offersOf(studio.product_id)
      expect(bike).toMatchObject({
        name: 'City bike',
        binding: 'free',
        schedule: 'subset',
        collection: 'online',
        mode: 'optional',
        parent_product_id: studio.product_id,
        in_cart: false,
        price_preview: { unit_price_cents: 1200, price_unit: 'night', currency: 'EUR' },
      })
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

// ac47r.2: a tandem catalogue shaped like landr-api's (daily_start_times / weekdays,
// pricing rules, add-ons, alternatives).
const TANDEM_CATALOGUE = {
  template_slug: 'tandem', version: 1, groups: [],
  products: [
    {
      ...bare, slug: 'tandem-flight', name: 'Tandem flight', name_localized: { de: 'Tandemflug' },
      product_kind: 'service', service_time_shape: 'single_date',
      price_per_unit: 120, price_from: '110.00', price_base: '120.00',
      daily_start_times: ['09:00', '11:00', '15:00'], daily_start_weekdays: null,
      pricing: {
        currency: 'EUR',
        rules: [
          { rule_kind: 'slot_time_adjustment', sort_order: 10, conditions: {}, tiers: [],
            params: { time_from: '09:00', time_to: '09:00', adjustment: -10, name: 'Early bird' } },
          { rule_kind: 'weekday_adjustment', sort_order: 20, conditions: {}, tiers: [],
            params: { weekdays: [6, 7], adjustment: 20, name: 'Weekend' } },
          { rule_kind: 'slot_time_adjustment', sort_order: 30, conditions: {}, tiers: [],
            params: { weekdays: [5], time_from: '15:00', time_to: '23:59', adjustment: 20, name: 'Weekend' } },
        ],
      },
      addons: [
        { slug: 'photo-video', name: 'Photo and video', name_localized: { de: 'Foto und Video' },
          paid_to: 'performer', price_unit: 'booking', addon_quantity_rule: 'one_per_booking',
          price_per_unit: 35, currency: 'EUR', is_required: false, min_qty: 0, max_qty: 1, sort_order: 1 },
        { slug: 'transfer', name: 'Hotel transfer', paid_to: 'operator', price_unit: 'guest',
          addon_quantity_rule: 'any', price_per_unit: '10.00', currency: 'EUR', sort_order: 2 },
      ],
      alternatives: [{ slug: 'tandem-xl', sort_order: 1 }, { slug: 'ghost', sort_order: 2 }],
    },
    {
      ...bare, slug: 'tandem-xl', name: 'Tandem XL', product_kind: 'service', service_time_shape: 'single_date',
      price_per_unit: 160, price_from: '160.00', price_base: '160.00',
      daily_start_times: ['10:00'], daily_start_weekdays: [6, 7], pricing: null, addons: [], alternatives: [],
    },
  ],
}

describe('demo mode: slots, price rules, add-ons and alternatives (ac47r.2)', () => {
  beforeEach(() => {
    catalogue = TANDEM_CATALOGUE
    window.history.replaceState({}, '', '/?demo=tandem')
    resetDemoTemplateCache()
  })
  const body = (day: string, start: string | null, qty = 1, addon_lines: { product_id: string; qty: number }[] = []) => ({
    selected_days: [day], participants_count: qty, addon_lines, ...(start ? { slot_start_time: start } : {}),
  })

  it('offers the template start times, on its weekdays only', async () => {
    const [flight, xl] = await listProducts('demo-tandem')
    const slots = await getAvailability(flight.product_id, '2027-03-01', '2027-03-02')
    expect(slots.map((s) => s.start_time)).toEqual(['09:00:00', '11:00:00', '15:00:00', '09:00:00', '11:00:00', '15:00:00'])
    // 2027-03-05 Fri .. 03-08 Mon: XL runs on Sat/Sun only.
    const weekend = await getAvailability(xl.product_id, '2027-03-05', '2027-03-08')
    expect([...new Set(weekend.map((s) => s.date))]).toEqual(['2027-03-06', '2027-03-07'])
    expect(weekend.every((s) => s.start_time === '10:00:00')).toBe(true)
  })

  it('evaluates the real rules: early bird, weekend, Friday from 15:00', async () => {
    const [flight] = await listProducts('demo-tandem')
    const quote = async (day: string, start: string) =>
      (await estimateBookingPrice('demo-tandem', flight.product_id, body(day, start))).grand_total
    // 2027-03-03 is a Wednesday, 03-05 Friday, 03-06 Saturday.
    expect(await quote('2027-03-03', '09:00')).toBe('110.00')
    expect(await quote('2027-03-03', '11:00')).toBe('120.00')
    expect(await quote('2027-03-05', '11:00')).toBe('120.00')
    expect(await quote('2027-03-05', '15:00')).toBe('140.00')
    expect(await quote('2027-03-06', '11:00')).toBe('140.00')
    expect(await quote('2027-03-06', '09:00')).toBe('130.00')
    const est = await estimateBookingPrice('demo-tandem', flight.product_id, body('2027-03-06', '09:00', 2))
    expect(est.grand_total).toBe('260.00')
    expect(est.surcharges?.map((x) => [x.label, x.amount])).toEqual([['Weekend', '40.00']])
    expect(est.savings?.map((x) => [x.label, x.amount])).toEqual([['Early bird', '20.00']])
    expect(est.amount_due).toBe('260.00')
  })

  it('reads the slot from the picked demo slot id; the sole fixed time is used otherwise', async () => {
    const [flight] = await listProducts('demo-tandem')
    const slots = await getAvailability(flight.product_id, '2027-03-03', '2027-03-03')
    const early = await estimateBookingPrice('demo-tandem', flight.product_id, {
      selected_days: ['2027-03-03'], participants_count: 1, addon_lines: [],
      product_availability_id: slots[0]!.availability_id!,
    })
    expect(early.grand_total).toBe('110.00')
    // several fixed times and none picked: slot rules match nothing (as the API).
    const none = await estimateBookingPrice('demo-tandem', flight.product_id, body('2027-03-03', null))
    expect(none.grand_total).toBe('120.00')
  })

  it('applies percent rules and midnight-wrapping windows like the engine', () => {
    const rules = [
      { rule_kind: 'slot_time_adjustment', params: { time_from: '22:00', time_to: '02:00', adjustment: 10, adjustment_type: 'percent' } },
    ]
    expect(demoAdjustments(rules, ['2027-03-03'], '23:30', 'single_date', 200).map((a) => a.amount)).toEqual([20])
    expect(demoAdjustments(rules, ['2027-03-03'], '01:00', 'single_date', 200)).toHaveLength(1)
    expect(demoAdjustments(rules, ['2027-03-03'], '12:00', 'single_date', 200)).toEqual([])
    expect(demoAdjustments(rules, ['2027-03-03'], null, 'single_date', 200)).toEqual([])
  })

  it('serves the catalogue add-ons as offers and prices them by payee and unit', async () => {
    const [flight] = await listProducts('demo-tandem')
    const offers = await offersOf(flight.product_id)
    expect(offers.map((o) => [o.name, o.price_preview?.unit_price_cents, o.max_qty])).toEqual([
      ['Photo and video', 3500, 1], ['Hotel transfer', 1000, null],
    ])
    expect(offers[0]).toMatchObject({ name_localized: { de: 'Foto und Video' }, binding: 'booking', mode: 'optional' })
    const est = await estimateBookingPrice('demo-tandem', flight.product_id, body('2027-03-03', '11:00', 2, [
      { product_id: offers[0]!.product_id, qty: 1 }, { product_id: offers[1]!.product_id, qty: 1 },
    ]))
    // 2 x 120 + photo 35 (pilot keeps it) + transfer 10 per guest x 2.
    expect(est.operator_total).toBe('260.00')
    expect(est.performer_total).toBe('35.00')
    expect(est.grand_total).toBe('295.00')
    expect(est.line_items.map((l) => l.paid_to)).toEqual(['operator', 'performer', 'operator'])
  })

  it('marks an offer already taken under the line as in_cart and answers every requested line', async () => {
    const [flight] = await listProducts('demo-tandem')
    const [photo] = await offersOf(flight.product_id)
    const res = await getOffers({
      widget_token: 'demo',
      lines: [
        { line_id: 'main', product_id: flight.product_id },
        { line_id: 'o1', product_id: photo!.product_id, parent_line_id: 'main' },
      ],
      guests: [],
    })
    expect(res.lines.map((l) => [l.line_id, l.eligible])).toEqual([['main', true], ['o1', true]])
    const main = res.lines[0]!.offers!
    expect(main.find((o) => o.product_id === photo!.product_id)!.in_cart).toBe(true)
    expect(main.find((o) => o.product_id !== photo!.product_id)!.in_cart).toBe(false)
  })

  it('answers the submit with a full sample booking summary: slot, add-ons, rules, total, customer', async () => {
    const [flight] = await listProducts('demo-tandem')
    const addons = await offersOf(flight.product_id)
    const res = await submitBooking({
      widget_token: 'x', customer_first_name: 'Alex', customer_last_name: 'Morgan', customer_email: 'a@example.com',
      cancellation_deadline: '2027-03-01',
      products: [
        { product_id: flight.product_id, quantity: 2, selected_days: ['2027-03-06'], slot_start_time: '09:00' },
        { product_id: addons[0]!.product_id, quantity: 1 },
      ],
      participants: [
        { first_name: 'Alex', last_name: 'Morgan', service_role_code: 'participant' },
        { first_name: 'Sam', last_name: 'Morgan', service_role_code: 'participant' },
      ],
    } as unknown as SubmitBookingBody)
    const sum = res.summary!
    expect(res.booking_id).toBe('demo-booking')
    expect(sum.product_label).toBe('Tandem flight')
    expect(sum.dates.label).toContain('09:00')
    expect(sum.participants.map((p) => p.name)).toEqual(['Alex Morgan', 'Sam Morgan'])
    expect(sum.line_items.map((l) => l.paid_to)).toEqual(['operator', 'performer'])
    expect(sum.surcharges?.map((x) => x.label)).toEqual(['Weekend'])
    expect(sum.savings.map((x) => x.label)).toEqual(['Early bird'])
    expect(sum.grand_total).toBe('295.00')
  })

  it('serves alternatives from the catalogue, skipping unknown slugs', async () => {
    const [flight] = await listProducts('demo-tandem')
    const alts = await getProductAlternatives(flight.product_id, '2027-03-05', '2027-03-08')
    expect(alts).toHaveLength(1)
    expect(alts[0]).toMatchObject({ slug: 'tandem-xl', name: 'Tandem XL', price_from: '160.00' })
    expect(alts[0]!.available_dates).toEqual(['2027-03-06', '2027-03-07'])
  })

  it('has a sample customer in every demo language', () => {
    for (const lang of DEMO_LANGS) {
      const c = demoCustomer(lang)
      expect(c.email).toContain('@')
      expect(c.phone).toMatch(/^\+\d{8,}$/)
      expect(c.country).toBe('DE')
      expect(demoCompanion(0, lang).first_name).not.toBe(c.first_name)
    }
    expect(demoCustomer('de').first_name).toBe('Lena')
    expect(demoCustomer('en').first_name).toBe('Alex')
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
    // The offers evaluation is a read over POST: answered, not blocked.
    await expect(offersOf(full.product_id)).resolves.toBeInstanceOf(Array)
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

  it('covers the apartment city-bike add-on', async () => {
    const { demoArt } = await import('./demo')
    expect(demoArt('apartment', 'bike-rental', 'City bike')[0].hero_url).toMatch(/demo\/apartment\/bike-rental-1\.svg$/)
  })

  it('gives unknown products none', async () => {
    const { demoArt } = await import('./demo')
    expect(demoArt('kayak', 'nope', 'x')).toEqual([])
  })
})

describe('demoGroups art', () => {
  it('gives a group without a cover the art of its first product', async () => {
    const { demoGroups } = await import('./demo')
    const prod = { slug: 'half-day-tour', name: 'x', group_slug: 'tours', images: [] }
    const groups = demoGroups({
      slug: 'kayak',
      catalogue: {
        groups: [{ slug: 'tours', name: 'Tours', image_url: null, parent_slug: null }],
        products: [prod],
      },
    } as never)
    expect(groups[0].image_url).toMatch(/demo\/kayak\/half-day-tour-1\.svg$/)
  })
})
