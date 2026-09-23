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
import { browserLocale } from '@/lib/locale'
import { splitOnPlaceholder, tr } from '@/lib/strings'

interface Props {
  operatorToken: string
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
export function AccountLinkPrompt({ operatorToken, email }: Props) {
  const locale = browserLocale()
  const [bodyBefore, bodyAfter] = splitOnPlaceholder(tr('accountLinkBodyTemplate', locale), 'email')
  const [inboxBefore, inboxAfter] = splitOnPlaceholder(tr('checkYourInboxTemplate', locale), 'email')
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
      await requestMagicLink({ operatorToken, email })
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
          <CardTitle id={titleId}>{tr('trackBookingTitle', locale)}</CardTitle>
          <CardDescription id={descriptionId}>
            {bodyBefore}<span className="font-mono">{email}</span>{bodyAfter}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.kind === 'sent' ? (
            <p className="text-sm">
              {inboxBefore}
              <span className="font-mono">{email}</span>
              {inboxAfter}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {tr('accountLinkOptionalNote', locale)}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDecline}
                  disabled={state.kind === 'sending'}
                >
                  {tr('noThanksContinueAsGuest', locale)}
                </Button>
                <Button
                  ref={acceptButtonRef}
                  type="button"
                  onClick={onAccept}
                  disabled={state.kind === 'sending'}
                >
                  {state.kind === 'sending' ? tr('sendingEllipsis', locale) : tr('yesSendMeALink', locale)}
                </Button>
              </div>
              {state.kind === 'error' ? (
                <p className="text-sm text-destructive" role="alert">
                  {splitOnPlaceholder(tr('couldNotSendLinkTemplate', locale), 'message')[0]}
                  {state.message}
                  {splitOnPlaceholder(tr('couldNotSendLinkTemplate', locale), 'message')[1]}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
