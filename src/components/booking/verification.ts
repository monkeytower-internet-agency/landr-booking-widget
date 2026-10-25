import { HttpError, uploadVerificationFile } from '@/api/client'
import type {
  Product,
  VerificationFileKind,
  VerificationState,
  VerificationWaiver,
} from '@/api/types'
import { waiverLocale } from './verificationStrings'

/** What the customer entered for a verified registration. */
export interface VerificationInput {
  licence: File | null
  insurance: File | null
  signature: string
  accepted: boolean
}

export const EMPTY_VERIFICATION: VerificationInput = {
  licence: null,
  insurance: null,
  signature: '',
  accepted: false,
}

export const MAX_VERIFICATION_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

/** True when any booked product asks for verification. */
export function needsVerification(products: Array<Pick<Product, 'requires_verification'>>): boolean {
  return products.some((p) => p.requires_verification === true)
}

/** `null` = fine; otherwise why the file is refused (before any upload). */
export function fileProblem(file: File): 'size' | 'type' | null {
  if (file.size > MAX_VERIFICATION_BYTES) return 'size'
  // Some browsers report no type for HEIC; the API checks the real bytes anyway.
  if (file.type && !ALLOWED_TYPES.has(file.type)) return 'type'
  return null
}

export function verificationReady(v: VerificationInput): boolean {
  return (
    v.licence !== null &&
    v.insurance !== null &&
    fileProblem(v.licence) === null &&
    fileProblem(v.insurance) === null &&
    v.signature.trim() !== '' &&
    v.accepted
  )
}

/** The waiver text for the customer's language (operator-editable, de / en). */
export function waiverText(product: Pick<Product, 'waiver_text_localized'>, locale?: string): string | null {
  const map = product.waiver_text_localized
  if (!map) return null
  const lang = waiverLocale(locale)
  const text = map[lang] || map.en || map.de
  return text && text.trim() !== '' ? text : null
}

export function toWaiver(v: VerificationInput, locale?: string): VerificationWaiver {
  return {
    waiver_accepted: v.accepted,
    waiver_signature_name: v.signature.trim(),
    waiver_locale: waiverLocale(locale),
  }
}

/**
 * Upload the chosen files for a freshly created booking. Never throws: a file
 * that fails is simply still missing in the returned state, and the
 * confirmation screen offers the retry.
 */
export async function uploadChosenFiles(
  state: VerificationState,
  v: VerificationInput,
): Promise<VerificationState> {
  const token = state.upload_token
  if (!token) return state
  let latest: VerificationState = state
  const files: Array<[VerificationFileKind, File | null]> = [
    ['licence', v.licence],
    ['insurance', v.insurance],
  ]
  for (const [kind, file] of files) {
    if (!file) continue
    try {
      latest = { ...(await uploadVerificationFile(token, kind, file)), upload_token: token }
    } catch {
      // Stays missing; the confirmation screen offers the retry.
    }
  }
  return { ...latest, upload_token: token }
}

/** 409 from the submit: the product's daily cap has no seat left on a chosen day. */
export function isDailyCapReached(err: unknown): boolean {
  if (!(err instanceof HttpError) || err.status !== 409) return false
  const detail = err.detail
  return (
    detail !== null &&
    typeof detail === 'object' &&
    (detail as { error?: unknown }).error === 'daily_cap_reached'
  )
}

/** The server's own sentence for a full day, or a generic fallback. */
export function dailyCapMessage(err: HttpError): string {
  const message = (err.detail as { message?: unknown } | undefined)?.message
  return typeof message === 'string' && message ? message : 'This day is full. Please pick another day.'
}
