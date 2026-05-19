import type {
  AvailabilitySlot,
  FixedDateWindow,
  Location,
  OperatorSettings,
  Product,
  SubmitBookingResponse,
} from './types'

const today = () => new Date()

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

const addDays = (base: Date, n: number) => {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

const allMockProducts: Product[] = [
  {
    product_id: '00000000-0000-0000-0000-000000000001',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: { en: 'Tandem Classic', de: 'Tandem Classic', tr: 'Tandem Klasik' },
    short_description: 'Standard tandem experience over Babadağ.',
    short_description_localized: {
      en: 'Standard tandem experience over Babadağ.',
      de: 'Standard-Tandemerlebnis über dem Babadağ.',
      tr: 'Babadağ üzerinde standart tandem deneyimi.',
    },
    description: '**25 minutes** in the air over Babadağ.\n\n- Fully guided from launch to landing\n- Suitable for all fitness levels\n- GoPro footage available on request',
    duration_kind: 'time_slot',
    duration_minutes: 25,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '11111111-1111-1111-1111-111111111111',
    group_slug: 'courses',
    group_name: 'Courses',
    sort_order: 1,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: false,
  },
  {
    product_id: '00000000-0000-0000-0000-000000000002',
    slug: 'tandem-long',
    name: 'Tandem Long',
    name_localized: { en: 'Tandem Long', de: 'Tandem Lang' },
    short_description: 'Extended-flight tandem when conditions allow.',
    short_description_localized: null,
    description: null,
    duration_kind: 'time_slot',
    duration_minutes: 45,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '22222222-2222-2222-2222-222222222222',
    group_slug: 'guided-days',
    group_name: 'Guided Days',
    sort_order: 2,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: true,
  },
]

export const mockLocations: Location[] = [
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Ölüdeniz Beach',
    name_localized: { en: 'Ölüdeniz Beach', de: 'Ölüdeniz Strand', tr: 'Ölüdeniz Plajı' },
    parent_id: null,
    role_type: { code: 'beach', label: 'Beach' },
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000002',
    name: 'Hisarönü Main Square',
    name_localized: { en: 'Hisarönü Main Square', de: 'Hisarönü Hauptplatz', tr: 'Hisarönü Meydanı' },
    parent_id: null,
    role_type: { code: 'plaza', label: 'Plaza' },
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000003',
    name: 'Fethiye Harbour',
    name_localized: { en: 'Fethiye Harbour', de: 'Hafen Fethiye', tr: 'Fethiye Limanı' },
    parent_id: null,
    role_type: { code: 'hotel', label: 'Hotel' },
  },
]

export const mockProducts = (groupSlug?: string): Product[] => {
  if (!groupSlug) return allMockProducts
  return allMockProducts.filter((p) => p.group_slug === groupSlug)
}

export const mockAvailability = (productId: string): AvailabilitySlot[] => {
  const base = today()
  return Array.from({ length: 14 }, (_, i) => i + 1)
    .filter((n) => n % 3 !== 0)
    .map((offset) => {
      const d = addDays(base, offset)
      return {
        availability_id: `${productId}-${offset}`,
        date: isoDate(d),
        start_time: '09:00',
        end_time: '10:00',
        capacity: 6,
        capacity_reserved: offset % 2,
        available_seats: 6 - (offset % 2),
        status: 'open',
      }
    })
}

export const mockFixedDateWindows = (): FixedDateWindow[] => {
  const base = today()
  return [0, 28, 56].map((offset, idx) => {
    const start = addDays(base, 14 + offset)
    return {
      id: `mock-window-${idx}`,
      start_date: isoDate(start),
      end_date: isoDate(addDays(start, 6)),
      capacity: 8,
      capacity_reserved: idx === 1 ? 8 : idx,
    }
  })
}

export const mockOperatorSettings = (operatorSlug: string): OperatorSettings => ({
  slug: operatorSlug,
  expose_seats_to_customer: false,
})

export const mockSubmit = (): SubmitBookingResponse => ({
  booking_id: '00000000-0000-0000-0000-0000000000bb',
  reference: 'P42-MOCK-0001',
  state: 'pending',
})
