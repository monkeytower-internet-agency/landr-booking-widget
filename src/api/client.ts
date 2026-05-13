import type {
  AvailabilitySlot,
  Product,
  SubmitBookingBody,
  SubmitBookingResponse,
} from './types'
import { mockAvailability, mockProducts, mockSubmit } from './mocks'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === '1'
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('VITE_API_BASE_URL is not configured')
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
  return (await res.json()) as T
}

export async function listProducts(operatorSlug: string): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts
  return http<Product[]>(`/api/public/operators/${encodeURIComponent(operatorSlug)}/products`)
}

export async function getAvailability(
  productId: string,
  fromIso: string,
  toIso: string,
): Promise<AvailabilitySlot[]> {
  if (USE_MOCKS) return mockAvailability(productId)
  const qs = new URLSearchParams({ from: fromIso, to: toIso })
  return http<AvailabilitySlot[]>(
    `/api/public/products/${encodeURIComponent(productId)}/availability?${qs}`,
  )
}

export async function submitBooking(
  body: SubmitBookingBody,
): Promise<SubmitBookingResponse> {
  if (USE_MOCKS) return mockSubmit()
  return http<SubmitBookingResponse>('/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
