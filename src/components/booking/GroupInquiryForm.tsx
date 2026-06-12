/**
 * GroupInquiryForm (landr-ehye, redesigned landr-amg6) — the group /
 * flight-school inquiry form shown at the participant max.
 *
 * As of landr-amg6 this form lives inside an OVERLAY MODAL opened from the
 * "Request more" button in DetailsStep (it is no longer rendered inline in the
 * middle of the participants section). On submit it POSTs to
 * POST /api/public/operators/{token}/group-inquiry via the client helper. On
 * network / server error the form falls back to the existing mailto: link so
 * the customer always has a route to the operator.
 *
 * Required fields: Name + Email only. Phone (NEW, landr-amg6), Group size, and
 * Message are all optional and do NOT gate the Send button — they are sent to
 * the API as nullable values when blank (matching landr-vlxm). The Send button
 * stays disabled until Name + a valid Email are present.
 *
 * Pre-fills name + email (and, when available, phone) from the booker fields so
 * the customer doesn't type the same data twice.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitGroupInquiry } from '@/api/client'

export interface GroupInquiryFormProps {
  /** Opaque widget token — used as the {operator} path segment. */
  operatorToken: string
  /** Product slug for the current selection, or null. */
  productSlug: string | null
  /** Prefill for the name field (booker first + last). */
  defaultName?: string
  /** Prefill for the email field (booker email). */
  defaultEmail?: string
  /** Prefill for the (optional) phone field (booker phone). */
  defaultPhone?: string
  /** Operator contact email for the mailto: fallback. */
  contactMailto?: string
  /** Human-readable contact email shown as link text. */
  contactEmail?: string
  /**
   * Invoked when the customer cancels the inquiry (Cancel button). The host
   * (the modal in DetailsStep) closes the overlay and discards the in-progress
   * inquiry. Optional so the form still renders standalone in unit tests.
   */
  onCancel?: () => void
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export function GroupInquiryForm({
  operatorToken,
  productSlug,
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
  contactMailto,
  contactEmail,
  onCancel,
}: GroupInquiryFormProps) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState(defaultPhone)
  const [partySize, setPartySize] = useState('')
  const [message, setMessage] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // Field-level touched tracking (same pattern as DetailsStep).
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const markTouched = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  // Required-field validation helpers (only name + email are required).
  const requiredError = (key: string, value: string): string | undefined =>
    touched.has(key) && !value.trim() ? 'Required' : undefined
  const emailError = (key: string, value: string): string | undefined => {
    if (!touched.has(key)) return undefined
    if (!value.trim()) return 'Required'
    if (!value.includes('@')) return 'Enter a valid email address'
    return undefined
  }
  // Group size is optional: only flag a value that is present AND invalid.
  const partySizeError = (): string | undefined => {
    if (!touched.has('party_size')) return undefined
    if (!partySize.trim()) return undefined
    const n = Number(partySize)
    if (isNaN(n) || n < 1) return 'Enter a valid group size'
    return undefined
  }

  const nameErr = requiredError('name', name)
  const emailErr = emailError('email', email)
  const partySizeErr = partySizeError()

  // Send is gated ONLY on name + a valid email (mirrors DetailsStep's
  // required + '@' check). Phone / group size / message never gate Send.
  const isValid = Boolean(
    name.trim() && email.trim() && email.includes('@'),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Mark the gating fields touched so any gaps show validation errors.
    setTouched(new Set(['name', 'email']))
    if (!isValid) return

    setSubmitState('loading')
    const trimmedPartySize = partySize.trim()
    const partySizeValue =
      trimmedPartySize && Number(trimmedPartySize) >= 1
        ? Number(trimmedPartySize)
        : null
    try {
      await submitGroupInquiry(operatorToken, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        party_size: partySizeValue,
        message: message.trim() || null,
        product_slug: productSlug,
      })
      setSubmitState('success')
    } catch {
      setSubmitState('error')
    }
  }

  if (submitState === 'success') {
    return (
      <div className="flex flex-col gap-4" data-testid="group-inquiry-form">
        <p
          className="text-sm font-medium text-primary"
          data-testid="group-inquiry-success"
        >
          Thanks — we&rsquo;ll be in touch!
        </p>
        {onCancel ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              data-testid="group-inquiry-close"
            >
              Close
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      data-testid="group-inquiry-form"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Name (required) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="inquiry-name" className="text-xs">
            Your name
          </Label>
          <Input
            id="inquiry-name"
            name="inquiry_name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => markTouched('name')}
            aria-invalid={nameErr ? true : undefined}
            aria-describedby={nameErr ? 'inquiry-name-error' : undefined}
          />
          {nameErr ? (
            <p id="inquiry-name-error" className="text-xs text-destructive">
              {nameErr}
            </p>
          ) : null}
        </div>

        {/* Email (required) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="inquiry-email" className="text-xs">
            Email
          </Label>
          <Input
            id="inquiry-email"
            name="inquiry_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => markTouched('email')}
            aria-invalid={emailErr ? true : undefined}
            aria-describedby={emailErr ? 'inquiry-email-error' : undefined}
          />
          {emailErr ? (
            <p id="inquiry-email-error" className="text-xs text-destructive">
              {emailErr}
            </p>
          ) : null}
        </div>

        {/* Phone (optional, landr-amg6) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="inquiry-phone" className="text-xs">
            Phone <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="inquiry-phone"
            name="inquiry_phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* Group size (optional) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="inquiry-party-size" className="text-xs">
            Group size <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="inquiry-party-size"
            name="inquiry_party_size"
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            onBlur={() => markTouched('party_size')}
            aria-invalid={partySizeErr ? true : undefined}
            aria-describedby={partySizeErr ? 'inquiry-party-size-error' : undefined}
          />
          {partySizeErr ? (
            <p id="inquiry-party-size-error" className="text-xs text-destructive">
              {partySizeErr}
            </p>
          ) : null}
        </div>
      </div>

      {/* Message (optional) */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="inquiry-message" className="text-xs">
          Message <span className="text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="inquiry-message"
          name="inquiry_message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          placeholder="Tell us about your group, preferred dates, and any questions…"
        />
      </div>

      {/* On error, surface the message + mailto fallback but KEEP the form open
          so the customer can retry or switch to email (landr-amg6). */}
      {submitState === 'error' ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="group-inquiry-error"
        >
          Couldn&rsquo;t send your message. Please get in touch
          {contactMailto ? ': ' : '.'}
          {contactMailto ? (
            <a
              href={contactMailto}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
              data-testid="group-inquiry-mailto-fallback"
            >
              {contactEmail}
            </a>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={submitState === 'loading'}
              data-testid="group-inquiry-cancel"
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={!isValid || submitState === 'loading'}
            data-testid="group-inquiry-submit"
          >
            {submitState === 'loading' ? 'Sending…' : 'Send enquiry'}
          </Button>
        </div>
        {/* Always keep mailto as a secondary escape hatch */}
        {contactMailto ? (
          <a
            href={contactMailto}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            data-testid="participants-contact-mailto"
          >
            Or email us
          </a>
        ) : null}
      </div>
    </form>
  )
}
