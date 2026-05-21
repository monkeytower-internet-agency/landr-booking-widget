import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Hotel,
  Location,
  OperatorSettings,
  Product,
  ProductAddon,
  ServiceRole,
  SubmitBookingBody,
  SubmitBookingResponse,
} from './types'
import {
  mockAvailability,
  mockEstimate,
  mockFixedDateWindows,
  mockHotelRooms,
  mockLocations,
  mockOperatorServiceRoles,
  mockOperatorSettings,
  mockProductAddons,
  mockProducts,
  mockSubmit,
} from './mocks'

// Read env flags lazily (per-call) so tests can vi.stubEnv after the
// module is imported — contract tests in particular need to flip
// VITE_USE_MOCKS off mid-suite to exercise the real fetch path (landr-piyv).
const mocksEnabled = (): boolean => import.meta.env.VITE_USE_MOCKS === '1'
const apiBase = (): string =>
  (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

/**
 * Error thrown by `http()` when the response is non-2xx. Carries the
 * raw status, the response body text, and (when the body is FastAPI's
 * JSON envelope) a parsed `detail` array — typically a list of Pydantic
 * validation errors of shape {loc, msg, type}. Callers (e.g. the
 * BookingForm submit handler) format the detail array for the user so
 * the underlying contract mismatch is visible instead of the opaque
 * native fetch "Failed to fetch" string. Filed under landr-piyv.
 */
export class HttpError extends Error {
  status: number
  statusText: string
  body: string
  detail?: unknown
  constructor(status: number, statusText: string, body: string) {
    let detail: unknown
    let message = `${status} ${statusText}`
    try {
      const parsed: unknown = JSON.parse(body)
      if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
        detail = (parsed as { detail: unknown }).detail
      }
    } catch {
      // body wasn't JSON — leave detail undefined and fall back to text
    }
    if (body) message += `: ${body}`
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.statusText = statusText
    this.body = body
    this.detail = detail
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBase()) throw new Error('VITE_API_BASE_URL is not configured')
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new HttpError(res.status, res.statusText, body)
  }
  return (await res.json()) as T
}

export async function listProducts(
  operatorSlug: string,
  options?: { group?: string; includeHotelRooms?: boolean },
): Promise<Product[]> {
  let raw: Product[]
  if (mocksEnabled()) {
    raw = mockProducts(options?.group)
  } else {
    const qs = new URLSearchParams()
    if (options?.group) {
      qs.append('group', options.group)
    }
    const path = `/api/public/operators/${encodeURIComponent(operatorSlug)}/products`
    raw = await http<Product[]>(qs.toString() ? `${path}?${qs}` : path)
  }
  // Hotel rooms (landr-vyaz) are surfaced only inside AccommodationStep,
  // never in the main catalogue. Callers that need rooms use
  // getHotelRoomsForHotel which opts in via includeHotelRooms.
  if (options?.includeHotelRooms) return raw
  return raw.filter((p) => p.product_kind !== 'hotel_room')
}

export async function getAvailability(
  productId: string,
  fromIso: string,
  toIso: string,
): Promise<AvailabilitySlot[]> {
  if (mocksEnabled()) return mockAvailability(productId)
  const qs = new URLSearchParams({ from: fromIso, to: toIso })
  return http<AvailabilitySlot[]>(
    `/api/public/products/${encodeURIComponent(productId)}/availability?${qs}`,
  )
}

/**
 * Operator-level rendering/behaviour flags (landr-e10.9). The widget
 * calls this once on App mount and caches the result in OperatorContext.
 */
export async function getOperatorSettings(
  operatorSlug: string,
): Promise<OperatorSettings> {
  if (mocksEnabled()) return mockOperatorSettings(operatorSlug)
  return http<OperatorSettings>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/settings`,
  )
}

/**
 * Operator's active service_roles for the participant role dropdown
 * (landr-mg0a). The widget fetches this once on App mount alongside
 * getOperatorSettings. Returns the list ordered by (sort_order, label).
 * Defaults to whatever the API seeds for new operators (a single
 * 'participant' row); operators that have configured multiple roles
 * (e.g. 'pilot' + 'passenger' for paragliding tandems) surface the
 * full list and DetailsStep shows a dropdown per participant.
 */
export async function getOperatorServiceRoles(
  operatorSlug: string,
): Promise<ServiceRole[]> {
  if (mocksEnabled()) return mockOperatorServiceRoles(operatorSlug)
  return http<ServiceRole[]>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/service-roles`,
  )
}

/**
 * Stub pointing at the future GET /api/public/operators/{slug}/locations endpoint (landr-e10.8).
 * Falls back to mock data until the backend lands.
 */
export async function listLocations(operatorSlug: string): Promise<Location[]> {
  if (mocksEnabled()) return mockLocations
  return http<Location[]>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/locations`,
  )
}

/**
 * Operator's hotels (locations.role_type.code === 'hotel'). Used by the
 * widget AccommodationStep (landr-vyaz). Filtered client-side because
 * the public locations RPC already returns role_type and the catalogue
 * is tiny — a second RPC would cost a migration for no benefit.
 */
export async function getHotelsForOperator(
  operatorSlug: string,
): Promise<Hotel[]> {
  const locations = await listLocations(operatorSlug)
  return locations.filter((loc) => loc.role_type?.code === 'hotel')
}

/**
 * Hotel rooms (kind=hotel_room, hotel_location_id=hotelId) for a given
 * hotel under an operator (landr-vyaz). Filtered client-side off the
 * existing public_get_operator_products RPC — same rationale as
 * getHotelsForOperator.
 */
export async function getHotelRoomsForHotel(
  operatorSlug: string,
  hotelLocationId: string,
): Promise<Product[]> {
  if (mocksEnabled()) return mockHotelRooms(hotelLocationId)
  // opt-in: bypass the default hotel_room filter on listProducts so
  // the AccommodationStep can see the rooms it owns.
  const products = await listProducts(operatorSlug, { includeHotelRooms: true })
  return products.filter(
    (p) =>
      p.product_kind === 'hotel_room' &&
      p.hotel_location_id === hotelLocationId,
  )
}

/**
 * Returns upcoming, non-deleted, active windows for a fixed_date_range product.
 * Backed by public_get_product_fixed_date_windows RPC (landr-m05.28).
 * Uses the Supabase REST RPC endpoint exposed by Kong.
 */
export async function getFixedDateWindows(
  productId: string,
): Promise<FixedDateWindow[]> {
  if (mocksEnabled()) return mockFixedDateWindows()
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not configured')
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/public_get_product_fixed_date_windows`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ p_product_id: productId }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
  return (await res.json()) as FixedDateWindow[]
}

/**
 * Add-ons configured for a parent product (landr-cip6 / epic landr-ie8g).
 * Backed by GET /api/public/products/{id}/addons → SECURITY DEFINER RPC
 * public_get_product_addons. Returns an empty array when the parent has
 * no add-ons configured (or is itself hidden) — the widget treats empty
 * as "no add-ons UI to render".
 */
export async function getProductAddons(
  productId: string,
): Promise<ProductAddon[]> {
  if (mocksEnabled()) return mockProductAddons(productId)
  return http<ProductAddon[]>(
    `/api/public/products/${encodeURIComponent(productId)}/addons`,
  )
}

export async function submitBooking(
  body: SubmitBookingBody,
): Promise<SubmitBookingResponse> {
  if (mocksEnabled()) return mockSubmit()
  return http<SubmitBookingResponse>('/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Response shape from POST /api/public/bookings/{id}/cancel. The API
 * returns the same shape on both first-cancel and already-cancelled
 * (idempotent) paths so the widget doesn't need to branch on status.
 */
export interface CancelBookingResponse {
  ok: boolean
  booking_id: string
  message: string
}

/**
 * Customer one-click cancel (landr-sgnd). Backed by the public cancel
 * endpoint added in the API worker — auth is just the booking_id UUID
 * (v1 secrecy model, same as the iCal endpoint). Called from the
 * /cancel/{booking_id} confirm page after the customer clicks Yes.
 *
 * No mock fallback: this surface is reached only by following the
 * email link, which never lands in the demo/mocks flow. If
 * VITE_USE_MOCKS=1 we still hit the real API — there is no useful
 * mock for "cancel a booking that doesn't exist in mocks".
 */
export async function cancelBooking(
  bookingId: string,
): Promise<CancelBookingResponse> {
  return http<CancelBookingResponse>(
    `/api/public/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' },
  )
}

/**
 * Live booking-price estimator for the PriceSidebar (landr-qez0).
 * Backed by POST /api/public/operators/{slug}/products/{id}/estimate
 * (landr-xbqh) — reuses the canonical compute_booking_price engine so
 * the sidebar preview matches the gross_total persisted by
 * submit_booking bit-for-bit. No DB write. Returns the multi-line
 * breakdown (per-product line items, operator/hotel split, applied
 * pricing rules). The widget calls this debounced 300ms whenever
 * selected_days / participants_count / addon_lines changes.
 */
export async function estimateBookingPrice(
  operatorSlug: string,
  productId: string,
  body: EstimateRequestBody,
): Promise<EstimateResponse> {
  if (mocksEnabled()) return mockEstimate(productId, body)
  return http<EstimateResponse>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/products/${encodeURIComponent(productId)}/estimate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}
