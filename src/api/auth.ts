/**
 * LANDR account-link (passwordless sign-in) request.
 *
 * landr-16u9: this hits OUR backend
 * (`POST /api/public/operators/{token}/account-link`) instead of calling
 * Supabase Auth's `/auth/v1/otp` directly. The backend mints the magic link
 * via `supabase.auth.admin.generate_link` and delivers it through the
 * operator's Gmail + a branded template — so it needs no Supabase SMTP, never
 * sends the off-brand "Confirm signup" email, and the prompt is gated by the
 * operator's `offer_account_link` opt-in server-side.
 *
 * Configure via env:
 *   VITE_API_BASE_URL — the landr-api base (same one the rest of the widget
 *   already uses for products / estimate / submit).
 *
 * If the API base is missing the call rejects with a clear error; the caller
 * surfaces it inline without unwinding the booking confirmation.
 */

export interface RequestMagicLinkOptions {
  operatorToken: string
  email: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export async function requestMagicLink({
  operatorToken,
  email,
}: RequestMagicLinkOptions): Promise<void> {
  if (!apiBase) {
    throw new Error('VITE_API_BASE_URL is not configured')
  }
  const res = await fetch(
    `${apiBase}/api/public/operators/${encodeURIComponent(operatorToken)}/account-link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
}
