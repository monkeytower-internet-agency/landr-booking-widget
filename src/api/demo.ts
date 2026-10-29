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
import { formatDayRange } from '@/components/booking/dateLabel'
import { pickLocalized } from '@/lib/locale'
import type {
  AddonPriceUnit,
  AddonQuantityRule,
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
  ProductAddon,
  ProductAlternative,
  SavingLine,
  SurchargeLine,
  ServiceRole,
  ProductGroup,
  ServiceTimeShape,
  BookingSummary,
  SubmitBookingBody,
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

/** One rule of a catalogue product's `pricing.rules` (the price-list rules, slug-free). */
export interface DemoPricingRule {
  rule_kind: string
  sort_order?: number | null
  params?: Record<string, unknown> | null
  conditions?: unknown
  tiers?: unknown[] | null
}

export interface DemoCataloguePricing {
  currency?: string | null
  rules: DemoPricingRule[]
}

/** An add-on of a catalogue product (slug-keyed; becomes a `ProductAddon`). */
export interface DemoCatalogueAddon {
  slug: string
  name: string
  name_localized?: Record<string, string> | null
  description?: string | null
  description_localized?: Record<string, string> | null
  /** performer = the pilot keeps 100 percent. */
  paid_to?: 'operator' | 'hotel' | 'performer' | null
  price_unit?: AddonPriceUnit | null
  addon_quantity_rule?: AddonQuantityRule | null
  addon_quantity_max?: number | null
  price_per_unit?: number | string | null
  currency?: string | null
  pricing?: DemoCataloguePricing | null
  is_required?: boolean
  min_qty?: number
  max_qty?: number | null
  sort_order?: number
}

/** A linked alternative of a catalogue product (the target's slug). */
export interface DemoCatalogueAlternative {
  slug: string
  sort_order?: number
}

/** A product of `GET /api/public/templates/{slug}/catalogue` (slug-keyed, no ids). */
export type DemoCatalogueProduct = Omit<
  Product,
  | 'product_id' | 'product_group_id' | 'fixed_start_date' | 'fixed_end_date'
  | 'sport_subcategory_codes' | 'location_ids' | 'hotel_location_id'
> & {
  price_per_unit: number | string | null
  pass_tiers?: DemoCatalogueTier[] | null
  /** ISO weekdays (1 = Monday .. 7 = Sunday) the fixed daily start times run on; null = every day. */
  daily_start_weekdays?: number[] | null
  pricing?: DemoCataloguePricing | null
  addons?: DemoCatalogueAddon[] | null
  alternatives?: DemoCatalogueAlternative[] | null
}

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
  apartment: ['studio', 'family-apartment', 'rooftop-loft', 'bike-rental'],
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
  de: { company: 'deinem Unternehmen', city: 'deiner Stadt', email: 'deine E-Mail' },
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
    // Bundled art first: catalogue image URLs can point at a storage host the visitor's browser cannot reach.
    const art = demoArt(template.slug, c.slug, fill(c.name, 'en'))
    const images = art.length ? art : own
    const thumb = art.length ? art[0].thumb_url : (c.thumb_url ?? images[0]?.thumb_url ?? hero)
    // The tiers are served by the pass-tiers read, not carried on the product.
    const rest: Partial<DemoCatalogueProduct> = { ...c }
    delete rest.pass_tiers
    // Rules, add-ons and alternatives are served by their own reads / the estimate.
    delete rest.pricing
    delete rest.addons
    delete rest.alternatives
    return {
      ...rest,
      product_id: productId(template.slug, c.slug),
      name: fill(c.name, 'en'),
      name_localized: fillMap(c.name_localized),
      short_description: c.short_description == null ? null : fill(c.short_description, 'en'),
      short_description_localized: fillMap(c.short_description_localized),
      description: c.description == null ? null : fill(c.description, 'en'),
      description_localized: fillMap(c.description_localized),
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

/**
 * `?group=<slug>` scopes the list to that category and its sub-categories,
 * as the live endpoint does; no group means the whole catalogue.
 */
export function demoProductsInGroup(template: DemoTemplate, group: string | null): Product[] {
  const all = demoProducts(template)
  if (!group) return all
  const groups = template.catalogue?.groups ?? []
  const slugs = new Set([group])
  for (let grew = true; grew; ) {
    grew = false
    for (const g of groups) {
      if (g.parent_slug && slugs.has(g.parent_slug) && !slugs.has(g.slug)) {
        slugs.add(g.slug)
        grew = true
      }
    }
  }
  return all.filter((p) => p.group_slug != null && slugs.has(p.group_slug))
}

export function demoGroups(template: DemoTemplate): ProductGroup[] {
  const cat = template.catalogue
  if (!cat) return []
  return cat.groups.map((g) => ({
    ...g,
    // Groups carry no cover photo in templates: borrow the art of their first product.
    image_url: g.image_url ?? demoArt(template.slug, cat.products.find((c) => c.group_slug === g.slug)?.slug ?? '', g.name)[0]?.hero_url ?? null,
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

const hhmm = (t: string | null | undefined): string | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim())
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : null
}

/** ISO weekday (1 = Monday .. 7 = Sunday) of a YYYY-MM-DD day. */
const isoWeekday = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay() || 7

/** The slot rhythm of a product: its template start times and the weekdays they run on. */
export interface DemoSlotPlan {
  startTimes: string[] | null
  weekdays: number[] | null
}

function slotPlanOf(template: DemoTemplate, product: Product | undefined): DemoSlotPlan {
  const cat = template.catalogue?.products.find((c) => c.slug === product?.slug)
  const times = (cat?.daily_start_times ?? product?.daily_start_times ?? []).map(hhmm).filter((t): t is string => !!t)
  const days = (cat?.daily_start_weekdays ?? []).filter((w) => w >= 1 && w <= 7)
  return { startTimes: times.length ? [...times].sort() : null, weekdays: days.length ? days : null }
}

/**
 * Every day in [from, to] (clamped to a year) is open — nothing is ever sold out —
 * except, for an event product, the days outside its next occurrences. A product
 * with template start times offers exactly those (on its weekdays); a bare
 * `time_slot` product falls back to two sample times.
 */
export function demoAvailability(
  id: string,
  from: string,
  to: string,
  shape: ServiceTimeShape | null,
  eventWindow?: EventWindow | null,
  plan?: DemoSlotPlan | null,
): AvailabilitySlot[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Math.min(Date.parse(`${to}T00:00:00Z`), start + 366 * DAY_MS)
  const times = plan?.startTimes ?? (shape === 'time_slot' ? DEMO_START_TIMES : null)
  const out: AvailabilitySlot[] = []
  for (let t = start; t <= end; t += DAY_MS) {
    const date = iso(new Date(t))
    // an event product is open only on its next occurrences.
    if (eventWindow && !eventWindow.occurrences.some((o) => date >= o.start_date && date <= o.end_date)) continue
    if (plan?.weekdays && !plan.weekdays.includes(isoWeekday(date))) continue
    for (const st of times ?? [null]) {
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

// ------------------------------------------------------- price rules (demo)

/**
 * Mirror of landr-api `app/services/pricing.py`, section "Time-slot and
 * weekday adjustments": `slot_time_adjustment` (the slot's start time falls in
 * time_from..time_to inclusive, equal = one exact time, to < from wraps past
 * midnight, optional `weekdays`) and `weekday_adjustment` (the travel day's ISO
 * weekday is listed). A rule applies once per matching travel day; a flat
 * adjustment adds `adjustment x matching days`, a percent one
 * `running x adjustment% x matching / all days`. Other rule kinds are not
 * evaluated here: the base is the catalogue's base price.
 */
export interface DemoAdjustment {
  kind: 'slot_time_adjustment' | 'weekday_adjustment'
  label: string
  /** Signed amount added to the price of ONE unit (before the party size). */
  amount: number
}

const toMinutes = (t: string | null): number | null => {
  const h = hhmm(t)
  return h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null
}

const weekdaySet = (raw: unknown): Set<number> =>
  new Set((Array.isArray(raw) ? raw : []).map(Number).filter((w) => Number.isInteger(w) && w >= 1 && w <= 7))

const inWindow = (t: number, from: number, to: number): boolean =>
  from <= to ? t >= from && t <= to : t >= from || t <= to

const adjustmentRules = (rules: DemoPricingRule[] | null | undefined): DemoPricingRule[] =>
  (rules ?? [])
    .filter((r) => r.rule_kind === 'slot_time_adjustment' || r.rule_kind === 'weekday_adjustment')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

/** Days an adjustment is evaluated on: a fixed_window booking is one unit dated by its start day. */
const travelUnits = (days: string[], shape: ServiceTimeShape | null): string[] =>
  shape === 'fixed_window' ? days.slice(0, 1) : days

function adjustmentLabel(params: Record<string, unknown>, amount: number, lang: DemoLang): string {
  const name = typeof params.name === 'string' ? params.name : null
  const loc = params.name_localized && typeof params.name_localized === 'object'
    ? (params.name_localized as Record<string, string>) : null
  if (name || loc) return pickLocalized(name, loc, lang)
  if (amount < 0) return lang === 'de' ? 'Rabatt' : 'Discount'
  return lang === 'de' ? 'Zuschlag' : 'Surcharge'
}

/**
 * Evaluate a product's slot-time and weekday rules for the travel `days` and the
 * booked slot start (null = unknown: slot rules then match nothing, as the API).
 * `base` is the price of one unit across all days (percent rules scale with it).
 */
export function demoAdjustments(
  rules: DemoPricingRule[] | null | undefined,
  days: string[],
  slotStart: string | null,
  shape: ServiceTimeShape | null,
  base: number,
  lang: DemoLang = demoLang(),
): DemoAdjustment[] {
  const units = travelUnits(days, shape)
  const start = toMinutes(slotStart)
  const out: DemoAdjustment[] = []
  let running = base
  for (const rule of adjustmentRules(rules)) {
    const params = rule.params ?? {}
    const adj = Number(params.adjustment ?? 0) || 0
    let matched: string[]
    if (rule.rule_kind === 'weekday_adjustment') {
      const wd = weekdaySet(params.weekdays)
      matched = units.filter((d) => wd.has(isoWeekday(d)))
    } else {
      const from = toMinutes(String(params.time_from ?? ''))
      const rawTo = params.time_to
      const to = rawTo == null || rawTo === '' ? from : toMinutes(String(rawTo))
      if (from === null || to === null || start === null || !inWindow(start, from, to)) continue
      const only = params.weekdays ? weekdaySet(params.weekdays) : new Set<number>()
      matched = units.filter((d) => only.size === 0 || only.has(isoWeekday(d)))
    }
    if (matched.length === 0 || units.length === 0) continue
    const amount = params.adjustment_type === 'percent'
      ? (running * adj / 100 * matched.length) / units.length
      : adj * matched.length
    const rounded = Math.round(amount * 100) / 100
    running += rounded
    out.push({ kind: rule.rule_kind as DemoAdjustment['kind'], label: adjustmentLabel(params, rounded, lang), amount: rounded })
  }
  return out
}

/** The booked slot start: the explicit one, else the picked demo slot id, else the one fixed daily time. */
function slotStartOf(body: EstimateRequestBody, plan: DemoSlotPlan): string | null {
  const explicit = hhmm(body.slot_start_time)
  if (explicit) return explicit
  const picked = /-\d{4}-\d{2}-\d{2}-(\d{2}:\d{2})$/.exec(body.product_availability_id ?? '')
  if (picked) return picked[1]!
  return plan.startTimes?.length === 1 ? plan.startTimes[0]! : null
}

const addonUnits = (unit: AddonPriceUnit | null | undefined, nights: number, guests: number): number =>
  unit === 'night' ? nights : unit === 'guest' ? guests : unit === 'guest_night' ? nights * guests : 1

const addonId = (slug: string, key: string): string => `demo-${slug}-addon-${key}`

function findAddon(template: DemoTemplate, id: string): DemoCatalogueAddon | null {
  for (const p of template.catalogue?.products ?? []) {
    const hit = (p.addons ?? []).find((a) => addonId(template.slug, a.slug) === id)
    if (hit) return hit
  }
  return null
}

const money = (n: number): string => (Math.round(n * 100) / 100).toFixed(2)

export function demoEstimate(
  template: DemoTemplate,
  id: string,
  body: EstimateRequestBody,
): EstimateResponse {
  const lang = demoLang()
  const hit = findOffer(template, id)
  const days = Math.max(1, body.selected_days.length)
  const qty = Math.max(1, body.participants_count)
  const lines: EstimateResponse['line_items'] = []
  const totals = { operator: 0, hotel: 0, performer: 0 }
  const surcharges: SurchargeLine[] = []
  const savings: SavingLine[] = []
  let stay: EstimateResponse['stay'] = null
  if (hit?.product.product_kind === 'stay') {
    // A stay sells one unit for the night list: nights x nightly rate, plus the
    // one-off cleaning fee (landr-m6tp4.2). Same rules as the real estimate.
    const nights = [...new Set(body.selected_days)].sort()
    const config = hit.product.stay ?? null
    const fee = (config?.cleaning_fee_cents ?? 0) / 100
    // Weekday rules (the weekend surcharge) evaluate per night, as the real estimate does.
    const cat = template.catalogue?.products.find((c) => c.slug === hit.product.slug)
    const rules = adjustmentRules(cat?.pricing?.rules)
    const unitBase = rules.length ? Number(hit.product.price_per_unit ?? hit.price) || hit.price : hit.price
    const adjustments = demoAdjustments(cat?.pricing?.rules, nights, null, null, unitBase * nights.length, lang)
    const adjusted = unitBase * nights.length + adjustments.reduce((n, a) => n + a.amount, 0)
    const lineTotal = adjusted + fee
    totals.operator += lineTotal
    for (const a of adjustments) {
      const amount = money(Math.abs(a.amount))
      if (a.amount > 0) surcharges.push({ kind: 'surcharge', label: a.label, amount })
      else if (a.amount < 0) savings.push({ kind: 'discount', label: a.label, amount })
    }
    lines.push({
      product_id: id,
      label: pickLocalized(hit.product.name, hit.product.name_localized, lang),
      qty: 1,
      units: nights.length,
      unit_price: (adjusted / Math.max(1, nights.length)).toFixed(2),
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
    const shape = hit.product.service_time_shape ?? null
    const units = shape === 'days_range' ? days : 1
    const cat = template.catalogue?.products.find((c) => c.slug === hit.product.slug)
    const rules = adjustmentRules(cat?.pricing?.rules)
    // With rules the base is the list price; the cheapest "price from" already contains the discounts.
    const unitBase = rules.length ? Number(hit.product.price_per_unit ?? hit.price) || hit.price : hit.price
    const plan = slotPlanOf(template, hit.product)
    const adjustments = demoAdjustments(
      cat?.pricing?.rules, [...new Set(body.selected_days)].sort(), slotStartOf(body, plan), shape, unitBase * units, lang,
    )
    const adjusted = unitBase * units + adjustments.reduce((n, a) => n + a.amount, 0)
    const lineTotal = adjusted * qty
    totals.operator += lineTotal
    lines.push({
      product_id: id,
      label: pickLocalized(hit.product.name, hit.product.name_localized, lang),
      qty,
      units,
      unit_price: money(adjusted / units),
      line_total: money(lineTotal),
      paid_to: 'operator',
    })
    for (const a of adjustments) {
      const amount = money(Math.abs(a.amount) * qty)
      if (a.amount > 0) surcharges.push({ kind: 'surcharge', label: a.label, amount })
      else if (a.amount < 0) savings.push({ kind: 'discount', label: a.label, amount })
    }
  }
  // Add-ons: their catalogue price x units x quantity, paid to whoever the add-on says.
  const nights = Math.max(1, new Set(body.selected_days).size)
  for (const line of body.addon_lines ?? []) {
    const addon = findAddon(template, line.product_id)
    if (!addon || line.qty <= 0) continue
    const each = Number(addon.price_per_unit ?? 0) || 0
    const mult = addonUnits(addon.price_unit, nights, qty)
    const total = each * mult * line.qty
    const paidTo = addon.paid_to ?? 'operator'
    totals[paidTo] += total
    lines.push({
      product_id: line.product_id,
      label: pickLocalized(addon.name, addon.name_localized, lang),
      qty: line.qty,
      units: mult,
      unit_price: money(each),
      line_total: money(total),
      paid_to: paidTo,
    })
  }
  const grand = totals.operator + totals.hotel + totals.performer
  const surchargeTotal = surcharges.reduce((n, s) => n + Number(s.amount), 0)
  const savingTotal = savings.reduce((n, s) => n + Number(s.amount), 0)
  const itemised = surcharges.length + savings.length > 0
  return {
    line_items: lines,
    operator_total: money(totals.operator),
    hotel_total: money(totals.hotel),
    performer_total: money(totals.performer),
    grand_total: money(grand),
    currency: 'EUR',
    applied_rules: [...surcharges, ...savings].map((r) => ({ kind: r.kind, detail: { label: r.label, amount: r.amount } })),
    warnings: [],
    un_priceable: false,
    ...(itemised
      ? {
          surcharges,
          surcharges_total: money(surchargeTotal),
          subtotal_before_surcharges: money(totals.operator - surchargeTotal + savingTotal),
          savings,
          savings_total: money(savingTotal),
          subtotal_before_savings: money(totals.operator + savingTotal),
          amount_due: money(totals.operator),
        }
      : {}),
    ...(stay ? { stay } : {}),
  }
}

// ------------------------------------------------------ add-ons, alternatives

/** The add-ons of an offer, from its catalogue entry (empty for the sample fallback). */
export function demoAddons(template: DemoTemplate, id: string): ProductAddon[] {
  const hit = findOffer(template, id)
  const cat = template.catalogue?.products.find((c) => c.slug === hit?.product.slug)
  return [...(cat?.addons ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((a, i): ProductAddon => ({
      product_addon_id: `demo-${template.slug}-pa-${hit!.product.slug}-${a.slug}`,
      addon_product_id: addonId(template.slug, a.slug),
      name: fill(a.name, 'en'),
      name_localized: fillMap(a.name_localized),
      is_required: !!a.is_required,
      min_qty: a.min_qty ?? 0,
      max_qty: a.max_qty ?? null,
      sort_order: a.sort_order ?? i,
      price_per_unit: a.price_per_unit == null ? null : Number(a.price_per_unit),
      currency: a.currency ?? 'EUR',
      product_kind: 'service',
      addon_quantity_rule: a.addon_quantity_rule ?? null,
      addon_quantity_max: a.addon_quantity_max ?? null,
      price_unit: a.price_unit ?? null,
      available: true,
    }))
}

/** Linked alternatives of an offer with their open days / course windows inside [from, to]. */
export function demoAlternatives(template: DemoTemplate, id: string, from: string, to: string): ProductAlternative[] {
  const hit = findOffer(template, id)
  const cat = template.catalogue?.products.find((c) => c.slug === hit?.product.slug)
  const all = demoProducts(template)
  const out: ProductAlternative[] = []
  for (const alt of [...(cat?.alternatives ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const target = all.find((p) => p.slug === alt.slug)
    if (!target) continue
    const shape = target.service_time_shape ?? 'single_date'
    const isWindow = shape === 'fixed_window'
    const dates = isWindow
      ? null
      : [...new Set(
          demoAvailability(target.product_id, from, to, shape, target.event_window, slotPlanOf(template, target)).map((s) => s.date),
        )]
    const windows = isWindow
      ? demoFixedWindows()
          .filter((w) => w.start_date >= from && w.start_date <= to)
          .map((w) => ({ id: w.id, start_date: w.start_date, end_date: w.end_date, available_seats: w.capacity - w.capacity_reserved }))
      : null
    out.push({
      product_id: target.product_id,
      slug: target.slug,
      name: target.name,
      name_localized: target.name_localized,
      service_time_shape: shape,
      thumb_url: target.thumb_url ?? null,
      price_from: target.price_from ?? null,
      currency: target.currency ?? 'EUR',
      available_dates: dates,
      windows,
    })
  }
  return out
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

/**
 * The submit answer: a full sample booking summary built from what the viewer
 * "booked", priced by the same local estimate the sidebar used. Nothing is stored.
 */
export function demoSubmitResponse(template?: DemoTemplate, body?: SubmitBookingBody): SubmitBookingResponse {
  const base = { booking_id: DEMO_BOOKING_ID, semantic_state: 'demo', stage_code: 'demo' }
  const main = body?.products?.[0]
  const hit = template && main ? findOffer(template, main.product_id) : null
  if (!template || !body || !main || !hit) return base as SubmitBookingResponse
  const lang = demoLang()
  const days = [...new Set(main.selected_days ?? [])].sort()
  const count = Math.max(1, body.participants?.length ?? 1)
  const addonLines = (body.products ?? [])
    .slice(1)
    .filter((l) => findAddon(template, l.product_id))
    .map((l) => ({ product_id: l.product_id, qty: l.quantity ?? 1 }))
  const est = demoEstimate(template, main.product_id, {
    selected_days: days,
    participants_count: count,
    addon_lines: addonLines,
    product_availability_id: main.product_availability_id ?? undefined,
    slot_start_time: main.slot_start_time ?? undefined,
  })
  const label = pickLocalized(hit.product.name, hit.product.name_localized, lang)
  const slot = hhmm(main.slot_start_time) ?? /-\d{4}-\d{2}-\d{2}-(\d{2}:\d{2})$/.exec(main.product_availability_id ?? '')?.[1] ?? null
  const dateLabel = formatDayRange(days[0] ?? '', days[days.length - 1] ?? '', lang)
  const summary: BookingSummary = {
    booking_id: DEMO_BOOKING_ID,
    booking_reference: 'DEMO-0001',
    operator_name: '',
    product_label: label,
    products: [{ product_id: main.product_id, label, qty: main.quantity ?? 1, selected_days: days }],
    dates: { days, start: days[0] ?? null, end: days[days.length - 1] ?? null, label: slot ? `${dateLabel}, ${slot}` : dateLabel },
    participant_count: count,
    participants: (body.participants ?? []).map((p, i) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(' '),
      is_guiding: i === 0 ? true : undefined,
    })),
    pickup_location: null,
    pickup_locations: [],
    hotel: null,
    line_items: est.line_items,
    operator_total: est.operator_total,
    hotel_total: est.hotel_total,
    performer_total: est.performer_total,
    grand_total: est.grand_total,
    currency: est.currency,
    savings: est.savings ?? [],
    savings_total: est.savings_total ?? '0.00',
    subtotal_before_savings: est.subtotal_before_savings ?? est.operator_total,
    amount_due: est.amount_due ?? est.operator_total,
    multi_day_savings: null,
    surcharges: est.surcharges ?? null,
    surcharges_total: est.surcharges_total ?? null,
    subtotal_before_surcharges: est.subtotal_before_surcharges ?? null,
  }
  return { ...base, approval_outcome: 'auto_approved', payment_mode: 'on_site', summary } as SubmitBookingResponse
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
    if (pathname === '/api/public/bookings') return demoSubmitResponse(template, JSON.parse(String(init?.body ?? '{}')) as SubmitBookingBody) as T
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
    if (rest === '/products') return demoProductsInGroup(template, params.get('group')) as T
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
      return demoAvailability(
        id, params.get('from') ?? today, params.get('to') ?? today, hit?.product.service_time_shape ?? null,
        hit?.product.event_window, slotPlanOf(template, hit?.product),
      ) as T
    }
    if (rest === '/fixed-date-windows') return demoFixedWindows() as T
    if (rest === '/addons') return demoAddons(template, id) as T
    if (rest === '/alternatives') {
      const today = iso(new Date())
      return demoAlternatives(template, id, params.get('from') ?? today, params.get('to') ?? today) as T
    }
  }
  throw notFound(pathname)
}
