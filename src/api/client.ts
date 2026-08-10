import type {
  ApprovalReplyRequestBody,
  ApprovalReplyResult,
  ApprovalRequestContext,
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Hotel,
  Location,
  OperatorSettings,
  Product,
  ProductAddon,
  ProductGroup,
  ServiceRole,
  StaffSubmitBody,
  SubmitBookingBody,
  SubmitBookingResponse,
} from './types'
import type { ProductFlowResponse } from './flowTypes'
import {
  mockAvailability,
  mockEstimate,
  mockFixedDateWindows,
  mockHotelRooms,
  mockLocations,
  mockOperatorServiceRoles,
  mockOperatorSettings,
  mockProductAddons,
  mockProductGroups,
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
/**
 * Human-readable explanation for a failed widget API call (landr-brge
 * follow-up, user report 2026-06-05: the bare native "Failed to fetch"
 * gave operators nothing to act on). Distinguishes the three failure
 * classes a browser can produce and names the API host involved:
 *   - HttpError 404      → the widget link/token is wrong or outdated
 *   - HttpError other    → service responded with an error status
 *   - TypeError (native) → network unreachable OR the embedding site is
 *     not in the API's CORS allowlist — the two are indistinguishable
 *     from JS, so both are named.
 */
export function explainFetchError(err: unknown): string {
  let host = 'the booking service'
  try {
    const base = apiBase()
    if (base) host = new URL(base).host
  } catch {
    /* keep generic label */
  }
  if (err instanceof HttpError) {
    if (err.status === 404) {
      return `The booking service at ${host} did not recognise this booking link (404). The widget token may be wrong or outdated.`
    }
    return `The booking service at ${host} responded with an error (${err.status} ${err.statusText}).`
  }
  if (err instanceof TypeError) {
    return `Could not reach the booking service at ${host}. This usually means a network problem — or the site embedding this widget is not on the booking service's allowed-origins (CORS) list.`
  }
  return err instanceof Error ? err.message : String(err)
}

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
  operatorToken: string,
  options?: { group?: string; includeHotelRooms?: boolean; previewToken?: string },
): Promise<Product[]> {
  let raw: Product[]
  if (mocksEnabled()) {
    raw = mockProducts(options?.group, options?.previewToken)
  } else {
    const qs = new URLSearchParams()
    if (options?.group) {
      qs.append('group', options.group)
    }
    // landr-7zc5.3: when a preview_token is present, append it so the API
    // returns drafts alongside published products for this operator. The
    // API silently falls back to published-only when the token is absent,
    // wrong, or cross-operator (no error surfaced to the customer).
    if (options?.previewToken) {
      qs.append('preview_token', options.previewToken)
    }
    const path = `/api/public/operators/${encodeURIComponent(operatorToken)}/products`
    raw = await http<Product[]>(qs.toString() ? `${path}?${qs}` : path)
  }
  // Hotel rooms (landr-vyaz) are surfaced only inside AccommodationStep,
  // never in the main catalogue. Callers that need rooms use
  // getHotelRoomsForHotel which opts in via includeHotelRooms.
  if (options?.includeHotelRooms) return raw
  return raw.filter((p) => p.product_kind !== 'hotel_room')
}

/**
 * Product groups (categories) for the operator (landr-d8rg, epic contract E).
 * Returns active + non-deleted groups ordered by sort_order. product_count
 * reflects bookable products in each group subtree. Mirrors the pattern of
 * listProducts: mock switch, identical error handling via http().
 */
export async function listProductGroups(
  operatorToken: string,
  options?: { previewToken?: string },
): Promise<ProductGroup[]> {
  if (mocksEnabled()) return mockProductGroups(operatorToken, options?.previewToken)
  const qs = new URLSearchParams()
  if (options?.previewToken) {
    qs.append('preview_token', options.previewToken)
  }
  const path = `/api/public/operators/${encodeURIComponent(operatorToken)}/product-groups`
  return http<ProductGroup[]>(qs.toString() ? `${path}?${qs}` : path)
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
 * calls this once on App mount using the opaque widget_token (landr-il9f).
 * The response still carries the operator slug (resolved server-side) for
 * internal logic that is keyed on slug (e.g. Para42 declarations check).
 */
export async function getOperatorSettings(
  operatorToken: string,
): Promise<OperatorSettings> {
  if (mocksEnabled()) return mockOperatorSettings(operatorToken)
  return http<OperatorSettings>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/settings`,
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
  operatorToken: string,
): Promise<ServiceRole[]> {
  if (mocksEnabled()) return mockOperatorServiceRoles(operatorToken)
  return http<ServiceRole[]>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/service-roles`,
  )
}

/**
 * Response from POST /api/public/operators/{token}/subscription-perk/otp.
 * ALWAYS `{ ok: true }` — see requestSubscriptionPerkOtp for why.
 */
export interface RequestSubscriptionPerkOtpResponse {
  ok: boolean
}

/**
 * landr-fn4i (widget half of landr-5krc): fire the one-time subscription-perk
 * code email. Call this when the checkout email field is completed/blurred
 * (DetailsStep does this on the booker email's onBlur).
 *
 * CRITICAL: the endpoint ALWAYS responds 202 `{ok: true}` — member,
 * non-member, malformed address, or rate-limited caller all get the
 * IDENTICAL response, BY DESIGN, so the widget can never be used to probe
 * membership status. Callers MUST NOT branch UI on the response body (the
 * `ok` field carries no information — it's here only so the return type
 * isn't `void`); a network/host error is equally uninformative and should be
 * swallowed, not surfaced to the customer. A 404 means the widget_token
 * itself is wrong, which every other call on the page would also be failing
 * on — not something this call needs to handle specially.
 *
 * No mock-mode branch needed beyond the standard `{ok: true}` — there is no
 * meaningful "mock" for an endpoint whose whole point is to reveal nothing.
 */
export async function requestSubscriptionPerkOtp(
  operatorToken: string,
  email: string,
): Promise<RequestSubscriptionPerkOtpResponse> {
  if (mocksEnabled()) return { ok: true }
  return http<RequestSubscriptionPerkOtpResponse>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/subscription-perk/otp`,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  )
}

/**
 * Stub pointing at the GET /api/public/operators/{token}/locations endpoint (landr-e10.8).
 * Falls back to mock data until the backend lands.
 */
export async function listLocations(operatorToken: string): Promise<Location[]> {
  if (mocksEnabled()) return mockLocations
  return http<Location[]>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/locations`,
  )
}

/**
 * Operator's hotels (locations.role_type.code === 'hotel'). Used by the
 * widget AccommodationStep (landr-vyaz). Filtered client-side because
 * the public locations RPC already returns role_type and the catalogue
 * is tiny — a second RPC would cost a migration for no benefit.
 */
export async function getHotelsForOperator(
  operatorToken: string,
): Promise<Hotel[]> {
  const locations = await listLocations(operatorToken)
  return locations.filter((loc) => loc.role_type?.code === 'hotel')
}

/**
 * Hotel rooms (kind=hotel_room, hotel_location_id=hotelId) for a given
 * hotel under an operator (landr-vyaz). Filtered client-side off the
 * existing public_get_operator_products RPC — same rationale as
 * getHotelsForOperator.
 */
export async function getHotelRoomsForHotel(
  operatorToken: string,
  hotelLocationId: string,
): Promise<Product[]> {
  if (mocksEnabled()) return mockHotelRooms(hotelLocationId)
  // opt-in: bypass the default hotel_room filter on listProducts so
  // the AccommodationStep can see the rooms it owns.
  const products = await listProducts(operatorToken, { includeHotelRooms: true })
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
 * Staff-mode variant of getFixedDateWindows (landr-r2o8). The public RPC
 * above (public_get_product_fixed_date_windows, landr-drh) WHERE-clauses out
 * any window where capacity_reserved >= capacity in EVERY mode, including
 * staff — so FixedDateWindowPicker's force-book branch (landr-aoak.2 [S3])
 * had no full/overbooked window to ever render for fixed-date-window
 * products: the public RPC hid it before the branch could run.
 *
 * Backed by GET /api/staff/operators/{operator_id}/products/{product_id}/
 * fixed-date-window-availability?staff_session=<token> — a staff_session-
 * gated FastAPI route (landr-r2o8 api half) that requires the force_book
 * power and returns the SAME shape MINUS the capacity filter. Called ONLY
 * when FixedDateWindowPicker has resolved canForce (staff.active AND the
 * force_book power AND a decoded operatorId) — every other caller (normal
 * customer mode, catalogue chips) keeps using getFixedDateWindows unchanged,
 * so the byte-identical-with-no-session invariant holds.
 */
export async function getStaffFixedDateWindows(
  operatorId: string,
  productId: string,
  staffSessionToken: string,
): Promise<FixedDateWindow[]> {
  if (mocksEnabled()) return mockFixedDateWindows()
  const qs = new URLSearchParams({ staff_session: staffSessionToken })
  return http<FixedDateWindow[]>(
    `/api/staff/operators/${encodeURIComponent(operatorId)}/products/${encodeURIComponent(productId)}/fixed-date-window-availability?${qs}`,
  )
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
  options?: { previewToken?: string },
): Promise<SubmitBookingResponse> {
  if (mocksEnabled()) return mockSubmit()
  // landr-7zc5.3: include preview_token in the POST body when present so
  // the API can accept draft-product bookings during operator preview.
  // The API ignores this field when absent or when the token doesn't match
  // the operator (inactive/deleted/foreign products are still rejected).
  const payload = options?.previewToken
    ? { ...body, preview_token: options.previewToken }
    : body
  return http<SubmitBookingResponse>('/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Staff-authorized booking submit (landr-aoak.4, reconciling the drift the
 * aoak.3 dashboard worker found). In STAFF/agent mode the booking does NOT go
 * to the public endpoint — it goes to a SEPARATE, operator-scoped route the
 * api worker (landr-aoak.1 [S2]) added:
 *
 *   POST /api/staff/operators/{operator_id}/bookings/submit
 *
 * which takes NO widget_token and treats the signed `staff_session` in the body
 * as the credential. ONLY this route honours the operator powers (force-book,
 * price override, skip-approval, skip-customer-email); the public route
 * silently ignores them. Posting a staff submit to /api/public/bookings was the
 * bug — the powers were dropped server-side and the booking ran the normal
 * capacity + approval engine.
 *
 * The response is the staff RPC's jsonb (booking_id + semantic_state:'pending' +
 * stage_code:'awaiting_payment' + approval_outcome:'staff_authorized' + the
 * extra forced/price_overridden flags), which is a superset of
 * SubmitBookingResponse — so the widget's confirmation page + the
 * `landr:booking-created` postMessage read `booking_id` etc. unchanged.
 *
 * Mocks: in mock mode there is no staff RPC; we return the same mockSubmit()
 * shape so the embedded demo flow still resolves (parity with submitBooking).
 */
export async function submitStaffBooking(
  operatorId: string,
  body: StaffSubmitBody,
): Promise<SubmitBookingResponse> {
  if (mocksEnabled()) return mockSubmit()
  return http<SubmitBookingResponse>(
    `/api/staff/operators/${encodeURIComponent(operatorId)}/bookings/submit`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
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
  operatorToken: string,
  productId: string,
  body: EstimateRequestBody,
): Promise<EstimateResponse> {
  if (mocksEnabled()) return mockEstimate(productId, body)
  return http<EstimateResponse>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/products/${encodeURIComponent(productId)}/estimate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

/**
 * landr-71kz.4: fetch the product's operator-configured booking flow.
 * GET /api/public/operators/{token}/products/{productId}/flow
 * Returns {modules: [...]} or {modules: null} (legacy/no-flow path).
 * A network/404 error is NOT thrown — the caller receives null, which
 * the buildFlowPlan() legacy fallback handles. NEVER throws (widget has no
 * error boundary — bd memory landr-9ut4).
 */
export async function getProductFlow(
  operatorToken: string,
  productId: string,
): Promise<ProductFlowResponse | null> {
  if (mocksEnabled()) return { modules: null }
  try {
    return await http<ProductFlowResponse>(
      `/api/public/operators/${encodeURIComponent(operatorToken)}/products/${encodeURIComponent(productId)}/flow`,
    )
  } catch {
    // Network error / 404 / malformed response → null → legacy plan.
    return null
  }
}

/**
 * Request body for POST /api/public/operators/{token}/group-inquiry
 * (landr-ehye). Sent when a customer at the participant max requests a
 * larger group or flight-school booking.
 */
export interface GroupInquiryRequest {
  name: string
  email: string
  // landr-amg6: phone is a new optional field; the API (landr-vlxm) accepts it
  // as a nullable string. party_size + message are now optional too — only
  // name + email are required server-side.
  phone: string | null
  party_size: number | null
  message: string | null
  product_slug: string | null
}

/**
 * Minimal acknowledgement from the group-inquiry endpoint. The API
 * always returns {ok: true} on success; error shapes use HttpError.
 */
export interface GroupInquiryResponse {
  ok: boolean
}

/**
 * Submit a larger-group / flight-school inquiry (landr-ehye). The widget
 * shows this inline form when the customer reaches the participant max.
 * In mock mode we resolve immediately so the embedded demo flow still
 * renders the success state without a live API.
 */
export async function submitGroupInquiry(
  operatorToken: string,
  body: GroupInquiryRequest,
): Promise<GroupInquiryResponse> {
  if (mocksEnabled()) return { ok: true }
  return http<GroupInquiryResponse>(
    `/api/public/operators/${encodeURIComponent(operatorToken)}/group-inquiry`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

// ─── Offer page (landr-uvfg Track B) ─────────────────────────────────────────

/**
 * A single price-breakdown line from the offer.
 */
export interface OfferProductLine {
  product_id: string
  name: string
  name_localized: Record<string, string> | null
  date_range_start: string | null
  date_range_end: string | null
  selected_days: string[] | null
  quantity: number
}

/**
 * A participant listed on the offer.
 */
export interface OfferParticipant {
  first_name: string
  last_name: string | null
  service_role_label: string | null
}

/**
 * Totals block from the offer.
 */
export interface OfferTotals {
  gross_total: number
  tax_total: number
  net_total: number
  balance_due: number
  currency: string
}

/**
 * Customer details from the offer.
 */
export interface OfferCustomer {
  first_name: string
  last_name: string | null
  email: string | null
}

/**
 * Full offer data returned by GET /api/public/bookings/{token}.
 * Shape mirrors the public_get_booking_by_token RPC
 * (migration 20260512221007).
 */
export interface PublicBookingOffer {
  booking_id: string
  customer_semantic_state: string
  cancellation_deadline: string | null
  totals: OfferTotals
  customer: OfferCustomer
  product_lines: OfferProductLine[]
  participants: OfferParticipant[]
}

/**
 * Fetch offer details for a booking token (landr-uvfg.4b).
 * Backed by GET /api/public/bookings/{token} — the same token minted by
 * POST /api/staff/…/send-offer. No mock fallback: this surface is only
 * reached from the custom-offer email link.
 */
export async function getBookingByToken(
  token: string,
): Promise<PublicBookingOffer> {
  return http<PublicBookingOffer>(
    `/api/public/bookings/${encodeURIComponent(token)}`,
  )
}

/**
 * Request body for POST /api/public/payments/initiate.
 */
export interface InitiatePaymentRequest {
  booking_token: string
  return_url: string
  cancel_url: string
}

/**
 * Response from POST /api/public/payments/initiate.
 */
export interface InitiatePaymentResponse {
  checkout_url: string
  payment_id: string | null
  stripe_payment_intent_id: string | null
}

/**
 * Kick off a Stripe Checkout session for the offer (landr-uvfg.4b).
 * Backed by the existing POST /api/public/payments/initiate.
 * On success, the caller should redirect to `checkout_url`.
 * No mock fallback: the offer link is email-deep-link only.
 */
export async function initiatePayment(
  body: InitiatePaymentRequest,
): Promise<InitiatePaymentResponse> {
  return http<InitiatePaymentResponse>('/api/public/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Hotel room-request reply loop (landr-em0r.9) ────────────────────────────

/**
 * Fetch the read-only context for a hotel reply link (landr-em0r.9).
 * Backed by `GET /api/public/approval-requests/{token}` — this call is
 * REQUIRED to be side-effect-free on the API side (SECURITY DEFINER RPC,
 * STABLE): it mints nothing and records nothing. This is the ONLY call
 * ApprovalReplyPage makes on mount — email pre-fetchers (Outlook Safe
 * Links, Gmail) GET every link in an email, and a GET here must be
 * indistinguishable from "nobody ever opened this" (epic section 4, layer
 * 2). The `confirm_nonce` in the response is required by
 * submitApprovalReply below and exists nowhere else a scanner could guess
 * or replay it from (layer 3).
 *
 * No mock fallback — copy of the cancelBooking rationale (below): this
 * surface is only reached by following an email link and never lands in
 * the demo/mocks flow. If VITE_USE_MOCKS=1 we still hit the real API —
 * there is no useful mock for "resolve a token that doesn't exist in mocks".
 */
export async function getApprovalRequest(
  token: string,
): Promise<ApprovalRequestContext> {
  return http<ApprovalRequestContext>(
    `/api/public/approval-requests/${encodeURIComponent(token)}`,
  )
}

/**
 * Submit (or correct) the hotel's answer (landr-em0r.9). Backed by
 * `POST /api/public/approval-requests/{token}/response`. Called EXACTLY
 * once per human click of the confirm button — never from an effect, never
 * on mount (see getApprovalRequest above). `confirm_nonce` must come from
 * the most recent getApprovalRequest response; the API replies 422
 * `invalid_confirm_nonce` when it's stale (ApprovalReplyPage silently
 * re-GETs and retries once — a receptionist leaving the page open >15 min
 * is the common case, epic section 7) or `comment_required_for_changes`
 * when a `confirmed_with_changes` decision arrives without one (the widget
 * also disables the button client-side for this, belt and braces).
 *
 * No mock fallback — same reasoning as cancelBooking: this surface is only
 * reached by following an email link and never lands in the demo/mocks flow.
 */
export async function submitApprovalReply(
  token: string,
  body: ApprovalReplyRequestBody,
): Promise<ApprovalReplyResult> {
  return http<ApprovalReplyResult>(
    `/api/public/approval-requests/${encodeURIComponent(token)}/response`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}
