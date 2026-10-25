/**
 * Demo-mode API layer (see `src/lib/demo.ts`).
 *
 * In demo mode `client.ts` hands EVERY request to `demoRequest()` instead of
 * `fetch`. It answers read endpoints from sample data built here and refuses
 * every write, so the widget cannot create a booking, start a payment or send
 * a mail. The one real network call is the read-only template lookup
 * (`GET /api/public/templates/{slug}`) that names the demo and sizes its sample
 * catalogue — templates are hidden from operator lookups, so there is no
 * operator slug to resolve.
 */
import { demoLang, demoSlug } from '@/lib/demo'
import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  OperatorSettings,
  Product,
  ServiceRole,
  ServiceTimeShape,
  SubmitBookingResponse,
} from './types'

interface TemplatePitchLocale {
  headline?: string | null
  hero_url?: string | null
}

export interface DemoTemplate {
  slug: string
  flow?: 'solo' | 'company'
  product_count?: number
  pitch?: Record<string, TemplatePitchLocale> | null
}

/** Thrown for any write attempted in demo mode. Never reaches the network. */
export class DemoWriteBlockedError extends Error {
  constructor(method: string, path: string) {
    super(`Demo mode: ${method} ${path} is not available`)
    this.name = 'DemoWriteBlockedError'
  }
}

// ---------------------------------------------------------------- template

const templateCache = new Map<string, Promise<DemoTemplate>>()

function templatesBase(): string {
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
}

/**
 * The public template (slug, flow, product count, pitch). Cached per slug. A
 * failed lookup degrades to a bare `{ slug }` so the demo still renders its
 * sample catalogue offline.
 */
export function loadDemoTemplate(slug: string): Promise<DemoTemplate> {
  let p = templateCache.get(slug)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${templatesBase()}/api/public/templates/${encodeURIComponent(slug)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return { slug }
        return { ...((await res.json()) as DemoTemplate), slug }
      } catch {
        return { slug }
      }
    })()
    templateCache.set(slug, p)
  }
  return p
}

export function resetDemoTemplateCache(): void {
  templateCache.clear()
}

// ---------------------------------------------------------------- catalogue

interface SampleOffer {
  key: string
  en: string
  de: string
  descEn: string
  descDe: string
  shape: ServiceTimeShape
  price: number
  durationMinutes?: number
}

const SAMPLE_OFFERS: Record<string, SampleOffer[]> = {
  tandem: [
    {
      key: 'tandem-flight', en: 'Tandem flight', de: 'Tandemflug', shape: 'single_date', price: 120,
      descEn: 'A tandem paragliding flight. Pick a day, your pilot confirms the details.',
      descDe: 'Ein Tandem-Gleitschirmflug. Wähle einen Tag, dein Pilot stimmt die Details mit dir ab.',
    },
  ],
  tandem_company: [
    {
      key: 'tandem-flight', en: 'Tandem flight', de: 'Tandemflug', shape: 'single_date', price: 120,
      descEn: 'A tandem paragliding flight with one of our pilots.',
      descDe: 'Ein Tandem-Gleitschirmflug mit einem unserer Piloten.',
    },
  ],
  course: [
    {
      key: 'course', en: 'Course', de: 'Kurs', shape: 'fixed_window', price: 390,
      descEn: 'A course on fixed dates. Pick a date and book your place.',
      descDe: 'Ein Kurs an festen Terminen. Wähle einen Termin und buche deinen Platz.',
    },
  ],
  kayak: [
    {
      key: 'full-day-tour', en: 'Full-day tour', de: 'Ganztagestour', shape: 'days_range', price: 79,
      descEn: 'A guided full-day paddling tour.', descDe: 'Eine geführte Paddeltour über den ganzen Tag.',
    },
    {
      key: 'half-day-tour', en: 'Half-day tour', de: 'Halbtagestour', shape: 'single_date', price: 49,
      descEn: 'A guided half-day tour.', descDe: 'Eine geführte Halbtagestour.',
    },
    {
      key: 'rental', en: 'Rental', de: 'Verleih', shape: 'time_slot', price: 25, durationMinutes: 120,
      descEn: 'Rent a kayak for two hours.', descDe: 'Leihe ein Kajak für zwei Stunden.',
    },
  ],
  driving_school: [
    {
      key: 'driving-lesson', en: 'Driving lesson', de: 'Fahrstunde', shape: 'time_slot', price: 65, durationMinutes: 60,
      descEn: 'A 60 minute driving lesson.', descDe: 'Eine Fahrstunde à 60 Minuten.',
    },
  ],
}

const MAX_GENERIC_OFFERS = 4

function offersFor(template: DemoTemplate): SampleOffer[] {
  const known = SAMPLE_OFFERS[template.slug]
  if (known) return known
  const n = Math.min(MAX_GENERIC_OFFERS, Math.max(1, template.product_count ?? 1))
  return Array.from({ length: n }, (_, i) => ({
    key: `offer-${i + 1}`, en: `Sample offer ${i + 1}`, de: `Beispielangebot ${i + 1}`,
    descEn: 'A sample offer from this template.', descDe: 'Ein Beispielangebot aus dieser Vorlage.',
    shape: 'single_date' as const, price: 50 + i * 20,
  }))
}

const productId = (slug: string, key: string): string => `demo-${slug}-${key}`

function heroOf(template: DemoTemplate): string | null {
  const url = template.pitch?.[demoLang()]?.hero_url ?? template.pitch?.en?.hero_url ?? null
  return url && /^https:\/\//.test(url) ? url : null
}

export function demoProducts(template: DemoTemplate): Product[] {
  const hero = heroOf(template)
  return offersFor(template).map((o, i): Product => ({
    product_id: productId(template.slug, o.key),
    slug: o.key,
    name: o.en,
    name_localized: { en: o.en, de: o.de },
    short_description: o.descEn,
    short_description_localized: { en: o.descEn, de: o.descDe },
    description: null,
    guide_languages: [],
    product_kind: 'service',
    service_time_shape: o.shape,
    is_contiguous: o.shape === 'days_range',
    duration_minutes: o.durationMinutes ?? null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: i + 1,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: o.price,
    currency: 'EUR',
    is_publicly_listed: true,
    bookable: true,
    thumb_url: hero,
    images: hero ? [{ thumb_url: hero, hero_url: hero, alt: o.en }] : [],
    price_from: o.price.toFixed(2),
  }))
}

function findOffer(template: DemoTemplate, id: string): { offer: SampleOffer; product: Product } | null {
  const products = demoProducts(template)
  const offers = offersFor(template)
  const idx = products.findIndex((p) => p.product_id === id)
  return idx >= 0 ? { offer: offers[idx], product: products[idx] } : null
}

// ------------------------------------------------------------- generated data

const iso = (d: Date): string => d.toISOString().slice(0, 10)
const DAY_MS = 86_400_000
const DEMO_START_TIMES = ['09:00', '14:00']

/** Every day in [from, to] (clamped to a year) is open — nothing is ever sold out. */
export function demoAvailability(id: string, from: string, to: string, shape: ServiceTimeShape | null): AvailabilitySlot[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Math.min(Date.parse(`${to}T00:00:00Z`), start + 366 * DAY_MS)
  const timed = shape === 'time_slot'
  const out: AvailabilitySlot[] = []
  for (let t = start; t <= end; t += DAY_MS) {
    const date = iso(new Date(t))
    for (const st of timed ? DEMO_START_TIMES : [null]) {
      out.push({
        availability_id: `${id}-${date}-${st ?? 'day'}`,
        date,
        start_time: st ? `${st}:00` : null,
        end_time: null,
        capacity: 8,
        capacity_reserved: 0,
        available_seats: 8,
        status: 'open',
      })
    }
  }
  return out
}

export function demoFixedWindows(): FixedDateWindow[] {
  const base = Date.now()
  return [14, 42, 70].map((offset, i) => ({
    id: `demo-window-${i}`,
    start_date: iso(new Date(base + offset * DAY_MS)),
    end_date: iso(new Date(base + (offset + 2) * DAY_MS)),
    capacity: 10,
    capacity_reserved: 0,
  }))
}

export function demoSettings(template: DemoTemplate): OperatorSettings {
  const lang = demoLang()
  const headline = template.pitch?.[lang]?.headline ?? template.pitch?.en?.headline ?? null
  return {
    slug: `demo-${template.slug}`,
    expose_seats_to_customer: false,
    logo_url: null,
    primary_color: null,
    theme: null,
    name: headline ?? 'Demo',
    widget_headline: null,
    widget_description: null,
    widget_footer: null,
    widget_headline_first_page_only: false,
    widget_description_first_page_only: false,
    widget_footer_first_page_only: false,
    offer_account_link: false,
    contact_email: null,
    has_member_perks: false,
    remove_powered_by: true,
    customer_languages: [lang],
    default_locale: lang,
  } as OperatorSettings
}

const demoRoles = (): ServiceRole[] => [
  { id: 'demo-role-participant', code: 'participant', label: 'Participant', label_localized: null, sort_order: 0 },
]

export function demoEstimate(
  template: DemoTemplate,
  id: string,
  body: EstimateRequestBody,
): EstimateResponse {
  const hit = findOffer(template, id)
  const days = Math.max(1, body.selected_days.length)
  const qty = Math.max(1, body.participants_count)
  const lines: EstimateResponse['line_items'] = []
  let total = 0
  if (hit) {
    const units = hit.offer.shape === 'days_range' ? days : 1
    const lineTotal = hit.offer.price * units * qty
    total = lineTotal
    lines.push({
      product_id: id,
      label: hit.offer.en,
      qty,
      units,
      unit_price: hit.offer.price.toFixed(2),
      line_total: lineTotal.toFixed(2),
      paid_to: 'operator',
    })
  }
  return {
    line_items: lines,
    operator_total: total.toFixed(2),
    hotel_total: '0.00',
    performer_total: '0.00',
    grand_total: total.toFixed(2),
    currency: 'EUR',
    applied_rules: [],
    warnings: [],
    un_priceable: false,
  }
}

/** What the checkout "submit" resolves with in demo mode. The App swaps in the congrats screen. */
export const DEMO_BOOKING_ID = 'demo-booking'

export function demoSubmitResponse(): SubmitBookingResponse {
  return { booking_id: DEMO_BOOKING_ID, semantic_state: 'demo', stage_code: 'demo' } as SubmitBookingResponse
}

// ------------------------------------------------------------------- router

function notFound(path: string): Error {
  // Mirrors client.HttpError's shape closely enough for `err.status === 404`
  // callers without importing it (client.ts imports this module).
  const e = new Error(`404 Not Found: ${path}`) as Error & { status: number; statusText: string; body: string }
  e.name = 'HttpError'
  e.status = 404
  e.statusText = 'Not Found'
  e.body = ''
  return e
}

const OP = /^\/api\/public\/operators\/[^/]+/
const PRODUCT = /^\/api\/public\/products\/([^/?]+)/

/**
 * Answer an API request locally. Reads return sample data; any non-GET other
 * than the local price estimate is refused (`DemoWriteBlockedError`) — the
 * guarantee the demo test asserts.
 */
export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const slug = demoSlug()
  const method = (init?.method ?? 'GET').toUpperCase()
  const [pathname, query = ''] = path.split('?')
  if (!slug) throw new Error('Demo mode is not active')
  const template = await loadDemoTemplate(slug)
  const params = new URLSearchParams(query)

  if (method === 'POST') {
    const est = /^\/api\/public\/operators\/[^/]+\/products\/([^/]+)\/estimate$/.exec(pathname)
    if (est) {
      const body = JSON.parse(String(init?.body ?? '{}')) as EstimateRequestBody
      return demoEstimate(template, decodeURIComponent(est[1]), body) as T
    }
    if (pathname === '/api/public/bookings') return demoSubmitResponse() as T
  }
  if (method !== 'GET') throw new DemoWriteBlockedError(method, pathname)

  if (OP.test(pathname)) {
    const rest = pathname.replace(OP, '')
    if (rest === '/products') return demoProducts(template) as T
    if (rest === '/product-groups') return [] as T
    if (rest === '/settings') return demoSettings(template) as T
    if (rest === '/service-roles') return demoRoles() as T
    if (rest === '/locations') return [] as T
    if (/^\/products\/[^/]+\/flow$/.test(rest)) return { modules: null } as T
    const tiers = /^\/products\/([^/]+)\/pass-tiers$/.exec(rest)
    if (tiers) {
      return { product_id: decodeURIComponent(tiers[1]), currency: 'EUR', is_member: false, tiers: [] } as T
    }
  }
  const pm = PRODUCT.exec(pathname)
  if (pm) {
    const id = decodeURIComponent(pm[1])
    const rest = pathname.replace(PRODUCT, '')
    const hit = findOffer(template, id)
    if (rest === '/availability') {
      const today = iso(new Date())
      return demoAvailability(id, params.get('from') ?? today, params.get('to') ?? today, hit?.offer.shape ?? null) as T
    }
    if (rest === '/fixed-date-windows') return demoFixedWindows() as T
    if (rest === '/alternatives' || rest === '/addons') return [] as T
  }
  throw notFound(pathname)
}
