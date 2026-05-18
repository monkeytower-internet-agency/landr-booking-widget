/**
 * Minimal Supabase OTP (magic link) client.
 *
 * Calls the Supabase auth REST endpoint directly so we don't have to pull in
 * the full `@supabase/supabase-js` SDK (which would bloat the widget bundle
 * loaded inside the WordPress iframe). The same JSON shape that the SDK's
 * `signInWithOtp({ email })` would post is used here.
 *
 * Configure via env:
 *   VITE_SUPABASE_URL       — e.g. https://supabase.dev.landr.de (dev) or the
 *                              prod Supabase project URL.
 *   VITE_SUPABASE_ANON_KEY  — publishable anon key.
 *
 * If either env var is missing, `requestMagicLink` rejects with a clear error;
 * the caller is expected to surface that to the user without unwinding the
 * booking confirmation.
 */

export interface RequestMagicLinkOptions {
  email: string
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export async function requestMagicLink({ email }: RequestMagicLinkOptions): Promise<void> {
  if (!SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL is not configured')
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not configured')
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      // Create the auth user on first link so guest customers can opt in.
      create_user: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
}
