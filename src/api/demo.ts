/**
 * Demo-mode API layer (see `src/lib/demo.ts`).
 *
 * In demo mode `client.ts` hands EVERY request to `demoRequest()` instead of
 * `fetch`. It answers read endpoints from sample data built here and refuses
 * every write, so the widget cannot create a booking, start a payment or send
 * a mail. The only real network calls are the two read-only template lookups:
 * `GET /api/public/templates/{slug}` (names the demo) and
 * `GET /api/public/templates/{slug}/catalogue` (the template's real groups and
 * products) — templates are hidden from operator lookups, so there is no
 * operator slug to resolve. Hand-written sample offers are only the fallback
 * for when the catalogue request fails.
 */
import { checkStayRange, stayWindowOf } from '@/components/booking/accommodationCalc'
import { DEMO_LANGS, demoLang, demoSlug, type DemoLang } from '@/lib/demo'
import { pickLocalized } from '@/lib/locale'
import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EventWindow,
  EstimateResponse,
  FixedDateWindow,
  OperatorSettings,
  PassTier,
  PassTiersResponse,
  PassValidityKind,
  Product,
  ServiceRole,
  ProductGroup,
  ServiceTimeShape,
  SubmitBookingResponse,
} from './types'

interface TemplatePitchLocale {
  headline?: string | null
  hero_url?: string | null
}

/** One tier of a pass product in the catalogue (no id: the position stands in for it). */
export interface DemoCatalogueTier {
  label: string
  validity_kind: PassValidityKind
  validity_days?: number | null
  season_start?: string | null
  season_end?: string | null
  /** Guest price in cents. */
  price_cents: number
  member_price_cents?: number | null
}

/** A product of `GET /api/public/templates/{slug}/catalogue` (slug-keyed, no ids). */
export type DemoCatalogueProduct = Omit<
  Product,
  | 'product_id' | 'product_group_id' | 'fixed_start_date' | 'fixed_end_date'
  | 'sport_subcategory_codes' | 'location_ids' | 'hotel_location_id'
> & { price_per_unit: number | string | null; pass_tiers?: DemoCatalogueTier[] | null }

export type DemoCatalogueGroup = Omit<ProductGroup, 'id' | 'parent_id'> & { parent_slug: string | null }

export interface DemoCatalogue {
  groups: DemoCatalogueGroup[]
  products: DemoCatalogueProduct[]
}

export interface DemoTemplate {
  slug: string
  flow?: 'solo' | 'company'
  product_count?: number
  pitch?: Record<string, TemplatePitchLocale> | null
  /** The template's real catalogue; absent when the request failed (samples are used). */
  catalogue?: DemoCatalogue | null
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

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/**
 * The public template (slug, flow, product count, pitch) plus its real
 * catalogue. Cached per slug. A failed lookup degrades to a bare `{ slug }`
 * (and a failed catalogue to sample offers) so the demo still renders offline.
 */
export function loadDemoTemplate(slug: string): Promise<DemoTemplate> {
  let p = templateCache.get(slug)
  if (!p) {
    const base = `${templatesBase()}/api/public/templates/${encodeURIComponent(slug)}`
    p = (async () => {
      const [head, cat] = await Promise.all([
        getJson<DemoTemplate>(base),
        getJson<DemoCatalogue>(`${base}/catalogue`),
      ])
      const catalogue = cat && Array.isArray(cat.products) && cat.products.length > 0 ? cat : null
      return { ...(head ?? {}), slug, catalogue }
    })()
    templateCache.set(slug, p)
  }
  return p
}

export function resetDemoTemplateCache(): void {
  templateCache.clear()
}

// ---------------------------------------------------------------- catalogue

type L = Record<DemoLang, string>

interface SampleOffer {
  key: string
  name: L
  desc: L
  shape: ServiceTimeShape
  price: number
  durationMinutes?: number
}

const TANDEM: L = { en: 'Tandem flight', de: 'Tandemflug', es: 'Vuelo en tándem', it: 'Volo in tandem', tr: 'Tandem uçuş' }
const FULL_DAY: L = { en: 'Full-day tour', de: 'Ganztagestour', es: 'Excursión de día completo', it: 'Tour di una giornata', tr: 'Tam gün tur' }
const HALF_DAY: L = { en: 'Half-day tour', de: 'Halbtagestour', es: 'Excursión de medio día', it: 'Tour di mezza giornata', tr: 'Yarım gün tur' }

const SAMPLE_OFFERS: Record<string, SampleOffer[]> = {
  tandem: [
    {
      key: 'tandem-flight', name: TANDEM, shape: 'single_date', price: 120,
      desc: {
        en: 'A tandem paragliding flight. Pick a day, your pilot confirms the details.',
        de: 'Ein Tandem-Gleitschirmflug. Wähle einen Tag, dein Pilot stimmt die Details mit dir ab.',
        es: 'Un vuelo en parapente en tándem. Elige un día y tu piloto confirmará los detalles.',
        it: 'Un volo in parapendio in tandem. Scegli un giorno, il tuo pilota conferma i dettagli.',
        tr: 'Bir tandem yamaç paraşütü uçuşu. Bir gün seç, pilotun ayrıntıları onaylar.',
      },
    },
  ],
  tandem_company: [
    {
      key: 'tandem-flight', name: TANDEM, shape: 'single_date', price: 120,
      desc: {
        en: 'A tandem paragliding flight with one of our pilots.',
        de: 'Ein Tandem-Gleitschirmflug mit einem unserer Piloten.',
        es: 'Un vuelo en parapente en tándem con uno de nuestros pilotos.',
        it: 'Un volo in parapendio in tandem con uno dei nostri piloti.',
        tr: 'Pilotlarımızdan biriyle tandem yamaç paraşütü uçuşu.',
      },
    },
  ],
  course: [
    {
      key: 'course', shape: 'fixed_window', price: 390,
      name: { en: 'Course', de: 'Kurs', es: 'Curso', it: 'Corso', tr: 'Kurs' },
      desc: {
        en: 'A course on fixed dates. Pick a date and book your place.',
        de: 'Ein Kurs an festen Terminen. Wähle einen Termin und buche deinen Platz.',
        es: 'Un curso con fechas fijas. Elige una fecha y reserva tu plaza.',
        it: 'Un corso con date fisse. Scegli una data e prenota il tuo posto.',
        tr: 'Sabit tarihli bir kurs. Bir tarih seç ve yerini ayırt.',
      },
    },
  ],
  kayak: [
    {
      key: 'full-day-tour', name: FULL_DAY, shape: 'days_range', price: 79,
      desc: {
        en: 'A guided full-day paddling tour.',
        de: 'Eine geführte Paddeltour über den ganzen Tag.',
        es: 'Una excursión guiada de remo de día completo.',
        it: 'Un tour guidato in kayak di una giornata intera.',
        tr: 'Rehberli, tam gün süren bir kürek turu.',
      },
    },
    {
      key: 'half-day-tour', name: HALF_DAY, shape: 'single_date', price: 49,
      desc: {
        en: 'A guided half-day tour.',
        de: 'Eine geführte Halbtagestour.',
        es: 'Una excursión guiada de medio día.',
        it: 'Un tour guidato di mezza giornata.',
        tr: 'Rehberli, yarım gün süren bir tur.',
      },
    },
    {
      key: 'rental', shape: 'time_slot', price: 25, durationMinutes: 120,
      name: { en: 'Rental', de: 'Verleih', es: 'Alquiler', it: 'Noleggio', tr: 'Kiralama' },
      desc: {
        en: 'Rent a kayak for two hours.',
        de: 'Leihe ein Kajak für zwei Stunden.',
        es: 'Alquila un kayak durante dos horas.',
        it: 'Noleggia un kayak per due ore.',
        tr: 'İki saatliğine bir kano kirala.',
      },
    },
  ],
  driving_school: [
    {
      key: 'driving-lesson', shape: 'time_slot', price: 65, durationMinutes: 60,
      name: { en: 'Driving lesson', de: 'Fahrstunde', es: 'Clase de conducción', it: 'Lezione di guida', tr: 'Direksiyon dersi' },
      desc: {
        en: 'A 60 minute driving lesson.',
        de: 'Eine Fahrstunde à 60 Minuten.',
        es: 'Una clase de conducción de 60 minutos.',
        it: 'Una lezione di guida di 60 minuti.',
        tr: '60 dakikalık bir direksiyon dersi.',
      },
    },
  ],
}

const MAX_GENERIC_OFFERS = 4

function offersFor(template: DemoTemplate): SampleOffer[] {
  const known = SAMPLE_OFFERS[template.slug]
  if (known) return known
  const n = Math.min(MAX_GENERIC_OFFERS, Math.max(1, template.product_count ?? 1))
  return Array.from({ length: n }, (_, i) => ({
    key: `offer-${i + 1}`,
    name: {
      en: `Sample offer ${i + 1}`, de: `Beispielangebot ${i + 1}`, es: `Oferta de ejemplo ${i + 1}`,
      it: `Offerta di esempio ${i + 1}`, tr: `Örnek teklif ${i + 1}`,
    },
    desc: {
      en: 'A sample offer from this template.',
      de: 'Ein Beispielangebot aus dieser Vorlage.',
      es: 'Una oferta de ejemplo de esta plantilla.',
      it: 'Un’offerta di esempio da questo modello.',
      tr: 'Bu şablondan örnek bir teklif.',
    },
    shape: 'single_date' as const, price: 50 + i * 20,
  }))
}

const productId = (slug: string, key: string): string => `demo-${slug}-${key}`
const groupId = (slug: string, key: string): string => `demo-${slug}-group-${key}`

function heroOf(template: DemoTemplate): string | null {
  const url = template.pitch?.[demoLang()]?.hero_url || template.pitch?.en?.hero_url || null
  return url && /^https:\/\//.test(url) ? url : null
}

/**
 * Comic sample art for the template catalogue (`public/demo/<template>/<product>-<n>.svg`,
 * made by `scripts/gen-demo-art.py`). Templates carry no photos of their own, so the demo
 * supplies them; a product the script has no art for simply gets none.
 */
const DEMO_ART_COUNT = 3
const DEMO_ART_PRODUCTS: Record<string, string[]> = {
  apartment: ['studio', 'family-apartment', 'rooftop-loft'],
  bike: ['half-day-rental', 'day-rental', 'ebike-rental', 'guided-city-tour', 'trail-day-tour'],
  course: ['course', 'weekend-workshop', 'taster-session'],
  driving_school: ['trial-lesson', 'intensive-week', 'driving-lesson', 'double-lesson', 'special-drive', 'test-drive', 'theory-class'],
  flight_school: ['beginner-course', 'ground-handling-day', 'refresher-day', 'thermal-clinic', 'safety-training', 'tandem-intro'],
  kayak: ['half-day-tour', 'full-day-tour', 'sunset-paddle', 'paddling-basics', 'rental'],
  retreat: ['retreat-programme', 'day-workshop', 'private-session', 'private-room', 'twin-room'],
  site_day_pass: ['site-pass', 'shuttle-pass', 'camper-pass', 'site-briefing'],
  tandem: ['tandem-flight', 'thermal-tandem', 'sunset-tandem'],
  tandem_company: ['tandem-flight', 'thermal-tandem', 'sunset-tandem', 'group-tandem-day'],
  testival: ['testival-day', 'testival-weekend', 'exhibitor-registration'],
}

export function demoArt(templateSlug: string, productSlug: string, name: string): NonNullable<Product['images']> {
  if (!DEMO_ART_PRODUCTS[templateSlug]?.includes(productSlug)) return []
  const base = `${import.meta.env.BASE_URL}demo/${templateSlug}/${productSlug}`
  return Array.from({ length: DEMO_ART_COUNT }, (_, i) => {
    const url = `${base}-${i + 1}.svg`
    return { thumb_url: url, hero_url: url, alt: name }
  })
}

/** Template texts may carry clone placeholders; show neutral wording instead. */
const PLACEHOLDERS: Record<DemoLang, Record<string, string>> = {
  en: { company: 'your company', city: 'your city', email: 'your email' },
  de: { company: 'dein Unternehmen', city: 'deine Stadt', email: 'deine E-Mail' },
  es: { company: 'tu empresa', city: 'tu ciudad', email: 'tu correo electrónico' },
  it: { company: 'la tua azienda', city: 'la tua città', email: 'la tua e-mail' },
  tr: { company: 'şirketin', city: 'şehrin', email: 'e-posta adresin' },
}

function fill(text: string | null | undefined, lang: DemoLang): string {
  return (text ?? '').replace(/\{(company|city|email)\}/g, (_m, k: string) => PLACEHOLDERS[lang][k])
}

function langOfKey(k: string): DemoLang {
  const base = k.toLowerCase().split(/[-_]/)[0]
  return (DEMO_LANGS as readonly string[]).includes(base) ? (base as DemoLang) : 'en'
}

function fillMap(m: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!m) return null
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fill(v, langOfKey(k))]))
}

const sampleProducts = (template: DemoTemplate): Product[] => {
  const hero = heroOf(template)
  return offersFor(template).map((o, i): Product => ({
    product_id: productId(template.slug, o.key),
    slug: o.key,
    name: o.name.en,
    name_localized: { ...o.name },
    short_description: o.desc.en,
    short_description_localized: { ...o.desc },
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
    images: hero ? [{ thumb_url: hero, hero_url: hero, alt: o.name.en }] : [],
    price_from: o.price.toFixed(2),
  }))
}

/** The template's real offers, given synthetic ids (nothing resolves a booking). */
const catalogueProducts = (template: DemoTemplate, cat: DemoCatalogue): Product[] => {
  const hero = heroOf(template)
  return cat.products.map((c): Product => {
    const own = (c.images ?? []).filter((im) => im.thumb_url || im.hero_url)
    const images = own.length ? own : demoArt(template.slug, c.slug, fill(c.name, 'en'))
    const thumb = c.thumb_url ?? images[0]?.thumb_url ?? hero
    // The tiers are served by the pass-tiers read, not carried on the product.
    const rest: Partial<DemoCatalogueProduct> = { ...c }
    delete rest.pass_tiers
    return {
      ...rest,
      product_id: productId(template.slug, c.slug),
      name: fill(c.name, 'en'),
      name_localized: fillMap(c.name_localized),
      short_description: c.short_description == null ? null : fill(c.short_description, 'en'),
      short_description_localized: fillMap(c.short_description_localized),
      description: c.description == null ? null : fill(c.description, 'en'),
      product_group_id: c.group_slug ? groupId(template.slug, c.group_slug) : null,
      fixed_start_date: null,
      fixed_end_date: null,
      sport_subcategory_codes: [],
      location_ids: [],
      needs_pickup: false,
      hotel_offering: 'none',
      hotel_location_id: null,
      guide_languages: c.guide_languages ?? [],
      is_contiguous: !!c.is_contiguous,
      sort_order: c.sort_order ?? 0,
      price_per_unit: c.price_per_unit == null ? null : Number(c.price_per_unit),
      currency: c.currency ?? 'EUR',
      is_publicly_listed: true,
      // Demo slots are generated and always open.
      bookable: true,
      thumb_url: thumb ?? null,
      images: images.length ? images : hero ? [{ thumb_url: hero, hero_url: hero, alt: c.name }] : [],
    } as Product
  })
}

export function demoProducts(template: DemoTemplate): Product[] {
  return template.catalogue ? catalogueProducts(template, template.catalogue) : sampleProducts(template)
}

export function demoGroups(template: DemoTemplate): ProductGroup[] {
  const cat = template.catalogue
  if (!cat) return []
  return cat.groups.map((g) => ({
    ...g,
    id: groupId(template.slug, g.slug),
    parent_id: g.parent_slug ? groupId(template.slug, g.parent_slug) : null,
    name: fill(g.name, 'en'),
    name_localized: fillMap(g.name_localized),
    description: g.description == null ? null : fill(g.description, 'en'),
    description_localized: fillMap(g.description_localized),
  }))
}

/** What one participant pays for one unit: the cheapest bookable price, else the base rate. */
const unitPrice = (p: Product): number => Number(p.price_from ?? p.price_per_unit ?? 0) || 0

function findOffer(template: DemoTemplate, id: string): { product: Product; price: number } | null {
  const product = demoProducts(template).find((p) => p.product_id === id)
  return product ? { product, price: unitPrice(product) } : null
}

// ------------------------------------------------------------- generated data

const iso = (d: Date): string => d.toISOString().slice(0, 10)
const DAY_MS = 86_400_000
const DEMO_START_TIMES = ['09:00', '14:00']

/**
 * Every day in [from, to] (clamped to a year) is open — nothing is ever sold out —
 * except, for an event product, the days outside its next occurrences.
 */
export function demoAvailability(
  id: string,
  from: string,
  to: string,
  shape: ServiceTimeShape | null,
  eventWindow?: EventWindow | null,
): AvailabilitySlot[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Math.min(Date.parse(`${to}T00:00:00Z`), start + 366 * DAY_MS)
  const timed = shape === 'time_slot'
  const out: AvailabilitySlot[] = []
  for (let t = start; t <= end; t += DAY_MS) {
    const date = iso(new Date(t))
    // an event product is open only on its next occurrences.
    if (eventWindow && !eventWindow.occurrences.some((o) => date >= o.start_date && date <= o.end_date)) continue
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
  const headline =
    template.pitch?.[lang]?.headline || template.pitch?.en?.headline || null
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

const PARTICIPANT_LABEL: L = {
  en: 'Participant', de: 'Teilnehmer', es: 'Participante', it: 'Partecipante', tr: 'Katılımcı',
}

const demoRoles = (): ServiceRole[] => [
  {
    id: 'demo-role-participant', code: 'participant', label: PARTICIPANT_LABEL.en,
    label_localized: { ...PARTICIPANT_LABEL }, sort_order: 0,
  },
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
  let stay: EstimateResponse['stay'] = null
  if (hit?.product.product_kind === 'stay') {
    // A stay sells one unit for the night list: nights x nightly rate, plus the
    // one-off cleaning fee (landr-m6tp4.2). Same rules as the real estimate.
    const nights = [...new Set(body.selected_days)].sort()
    const config = hit.product.stay ?? null
    const fee = (config?.cleaning_fee_cents ?? 0) / 100
    const lineTotal = hit.price * nights.length + fee
    total = lineTotal
    lines.push({
      product_id: id,
      label: pickLocalized(hit.product.name, hit.product.name_localized, demoLang()),
      qty: 1,
      units: nights.length,
      unit_price: hit.price.toFixed(2),
      line_total: lineTotal.toFixed(2),
      paid_to: 'operator',
      ...(fee > 0 ? { cleaning_fee: fee.toFixed(2) } : {}),
    })
    const window = stayWindowOf(nights)
    stay = {
      check_in: window?.checkIn ?? null,
      check_out: window?.checkOut ?? null,
      nights: nights.length,
      cleaning_fee: fee.toFixed(2),
      errors: window
        ? checkStayRange({
            check_in: window.checkIn,
            check_out: window.checkOut,
            min_nights: config?.min_nights ?? 1,
            max_nights: config?.max_nights ?? null,
            guests: body.participants_count,
            capacity: config?.sleeps ?? null,
            today: iso(new Date()),
          })
        : [{ code: 'invalid_range' }],
    }
  } else if (hit) {
    const units = hit.product.service_time_shape === 'days_range' ? days : 1
    const lineTotal = hit.price * units * qty
    total = lineTotal
    lines.push({
      product_id: id,
      label: pickLocalized(hit.product.name, hit.product.name_localized, demoLang()),
      qty,
      units,
      unit_price: hit.price.toFixed(2),
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
    ...(stay ? { stay } : {}),
  }
}

// ------------------------------------------------------------------- passes

/** The member proof the demo "issues" for any code: it only flips the tier prices. */
export const DEMO_MEMBER_PROOF = 'demo-member-proof'

/**
 * The tiers of a pass product (the template's real ones), priced for a guest or
 * — after the demo's pretend member code — for a member. Tier ids are
 * synthetic: nothing resolves them, the demo's checkout never reaches the API.
 */
export function demoPassTiers(template: DemoTemplate, id: string, isMember: boolean): PassTiersResponse {
  const hit = findOffer(template, id)
  const source = template.catalogue?.products.find((c) => c.slug === hit?.product.slug)?.pass_tiers ?? []
  const tiers = source.map((t, i): PassTier => {
    const memberCents = t.member_price_cents ?? null
    return {
      id: `demo-${template.slug}-${id}-tier-${i}`,
      label: fill(t.label, 'en'),
      validity_kind: t.validity_kind,
      validity_days: t.validity_days ?? null,
      season_start: t.season_start ?? null,
      season_end: t.season_end ?? null,
      price_cents: t.price_cents,
      has_member_price: memberCents !== null,
      member_price_cents: isMember ? memberCents : null,
      unit_price_cents: isMember && memberCents !== null ? memberCents : t.price_cents,
    }
  })
  return { product_id: id, currency: hit?.product.currency ?? 'EUR', is_member: isMember, tiers }
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
    // Member price of a pass: the emailed code is never sent and any code is
    // accepted, so the visitor can see the member tiers. Nothing is stored.
    if (/^\/api\/public\/operators\/[^/]+\/subscription-perk\/otp$/.test(pathname)) return { ok: true } as T
    if (/^\/api\/public\/operators\/[^/]+\/passes\/member-proof$/.test(pathname)) {
      return { member_proof: DEMO_MEMBER_PROOF, expires_in: 900 } as T
    }
  }
  if (method !== 'GET') throw new DemoWriteBlockedError(method, pathname)

  if (OP.test(pathname)) {
    const rest = pathname.replace(OP, '')
    if (rest === '/products') return demoProducts(template) as T
    if (rest === '/product-groups') return demoGroups(template) as T
    if (rest === '/settings') return demoSettings(template) as T
    if (rest === '/service-roles') return demoRoles() as T
    if (rest === '/locations') return [] as T
    if (/^\/products\/[^/]+\/flow$/.test(rest)) return { modules: null } as T
    const tiers = /^\/products\/([^/]+)\/pass-tiers$/.exec(rest)
    if (tiers) {
      const member = params.get('member_proof') === DEMO_MEMBER_PROOF
      return demoPassTiers(template, decodeURIComponent(tiers[1]), member) as T
    }
  }
  const pm = PRODUCT.exec(pathname)
  if (pm) {
    const id = decodeURIComponent(pm[1])
    const rest = pathname.replace(PRODUCT, '')
    const hit = findOffer(template, id)
    if (rest === '/availability') {
      const today = iso(new Date())
      return demoAvailability(id, params.get('from') ?? today, params.get('to') ?? today, hit?.product.service_time_shape ?? null, hit?.product.event_window) as T
    }
    if (rest === '/fixed-date-windows') return demoFixedWindows() as T
    if (rest === '/alternatives' || rest === '/addons') return [] as T
  }
  throw notFound(pathname)
}
