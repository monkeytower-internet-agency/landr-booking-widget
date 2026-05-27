import { useEffect, useId, useRef, useState } from 'react'
import { requestMagicLink } from '@/api/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Props {
  email: string
}

type PromptState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }
  | { kind: 'dismissed' }

/**
 * Non-blocking, inline account-link prompt shown alongside the booking
 * confirmation. Renders as an accessible non-modal dialog so screen readers
 * announce it without trapping focus away from the confirmation card.
 *
 * Failure path is intentionally soft: errors are surfaced as text within the
 * prompt and never unwind the booking confirmation.
 */
export function AccountLinkPrompt({ email }: Props) {
  const [state, setState] = useState<PromptState>({ kind: 'idle' })
  const dialogRef = useRef<HTMLDivElement>(null)
  const acceptButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Focus the primary action on mount so keyboard users land on "Yes".
  useEffect(() => {
    if (state.kind === 'idle') {
      acceptButtonRef.current?.focus()
    }
  }, [state.kind])

  // Esc dismisses the prompt without sending a magic link.
  useEffect(() => {
    if (state.kind === 'dismissed' || state.kind === 'sent') return
    const node = dialogRef.current
    if (!node) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setState({ kind: 'dismissed' })
      }
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [state.kind])

  if (state.kind === 'dismissed') return null

  const onAccept = async () => {
    setState({ kind: 'sending' })
    try {
      await requestMagicLink({ email })
      setState({ kind: 'sent' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Soft-fail: log + surface inline, but the booking stays confirmed.
      console.error('Magic-link request failed', err)
      setState({ kind: 'error', message })
    }
  }

  const onDecline = () => {
    setState({ kind: 'dismissed' })
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
    >
      <Card>
        <CardHeader>
          <CardTitle id={titleId}>Track this booking in the LANDR app</CardTitle>
          <CardDescription id={descriptionId}>
            Link <span className="font-mono">{email}</span> to a LANDR account so you can
            see your booking, get updates, and manage cancellations from your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.kind === 'sent' ? (
            <p className="text-sm">
              Check your inbox — we sent a sign-in link to{' '}
              <span className="font-mono">{email}</span>.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Optional — your booking is already confirmed either way.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDecline}
                  disabled={state.kind === 'sending'}
                >
                  No thanks, continue as guest
                </Button>
                <Button
                  ref={acceptButtonRef}
                  type="button"
                  onClick={onAccept}
                  disabled={state.kind === 'sending'}
                >
                  {state.kind === 'sending' ? 'Sending…' : 'Yes, send me a link'}
                </Button>
              </div>
              {state.kind === 'error' ? (
                <p className="text-sm text-destructive" role="alert">
                  Couldn't send the link: {state.message}. Your booking is still
                  confirmed.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
