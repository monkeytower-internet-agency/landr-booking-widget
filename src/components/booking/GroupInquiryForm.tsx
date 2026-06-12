/**
 * GroupInquiryForm (landr-ehye) — inline contact form shown at the participant
 * max when the customer needs a larger group or flight-school booking.
 *
 * Renders inside DetailsStep's "participants at max" notice. On submit it POSTs
 * to POST /api/public/operators/{token}/group-inquiry via the client helper.
 * On network / server error the form falls back to the existing mailto: link so
 * the customer always has a route to the operator.
 *
 * Pre-fills name + email from the booker fields when available (passed via
 * props) so the customer doesn't type the same data twice.
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
  /** Operator contact email for the mailto: fallback. */
  contactMailto?: string
  /** Human-readable contact email shown as link text. */
  contactEmail?: string
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export function GroupInquiryForm({
  operatorToken,
  productSlug,
  defaultName = '',
  defaultEmail = '',
  contactMailto,
  contactEmail,
}: GroupInquiryFormProps) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [partySize, setPartySize] = useState('')
  const [message, setMessage] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // Field-level touched tracking (same pattern as DetailsStep).
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const markTouched = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  // Required-field validation helpers.
  const requiredError = (key: string, value: string): string | undefined =>
    touched.has(key) && !value.trim() ? 'Required' : undefined
  const emailError = (key: string, value: string): string | undefined => {
    if (!touched.has(key)) return undefined
    if (!value.trim()) return 'Required'
    if (!value.includes('@')) return 'Enter a valid email address'
    return undefined
  }
  const partySizeError = (): string | undefined => {
    if (!touched.has('party_size')) return undefined
    const n = Number(partySize)
    if (!partySize.trim() || isNaN(n) || n < 1) return 'Enter a valid group size'
    return undefined
  }

  const nameErr = requiredError('name', name)
  const emailErr = emailError('email', email)
  const partySizeErr = partySizeError()
  const messageErr = requiredError('message', message)

  const isValid =
    name.trim() &&
    email.trim() &&
    email.includes('@') &&
    partySize.trim() &&
    Number(partySize) >= 1 &&
    !isNaN(Number(partySize)) &&
    message.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Mark all fields touched so any gaps show validation errors.
    setTouched(new Set(['name', 'email', 'party_size', 'message']))
    if (!isValid) return

    setSubmitState('loading')
    try {
      await submitGroupInquiry(operatorToken, {
        name: name.trim(),
        email: email.trim(),
        party_size: Number(partySize),
        message: message.trim(),
        product_slug: productSlug,
      })
      setSubmitState('success')
    } catch {
      setSubmitState('error')
    }
  }

  if (submitState === 'success') {
    return (
      <p
        className="text-sm font-medium text-primary"
        data-testid="group-inquiry-success"
      >
        Thanks — we&rsquo;ll be in touch!
      </p>
    )
  }

  // On error, fall back to the existing mailto: link (mirrors PR #108 fallback).
  if (submitState === 'error') {
    return (
      <p className="text-xs text-muted-foreground" data-testid="group-inquiry-error">
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
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 pt-2"
      data-testid="group-inquiry-form"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Name */}
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

        {/* Email */}
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

        {/* Party size */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="inquiry-party-size" className="text-xs">
            Group size
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

      {/* Message */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="inquiry-message" className="text-xs">
          Message
        </Label>
        <textarea
          id="inquiry-message"
          name="inquiry_message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => markTouched('message')}
          aria-invalid={messageErr ? true : undefined}
          aria-describedby={messageErr ? 'inquiry-message-error' : undefined}
          className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          placeholder="Tell us about your group, preferred dates, and any questions…"
        />
        {messageErr ? (
          <p id="inquiry-message-error" className="text-xs text-destructive">
            {messageErr}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={submitState === 'loading'}
          data-testid="group-inquiry-submit"
        >
          {submitState === 'loading' ? 'Sending…' : 'Send enquiry'}
        </Button>
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
