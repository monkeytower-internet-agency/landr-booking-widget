import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  getApprovalRequest,
  HttpError,
  submitApprovalReply,
} from '@/api/client'
import type {
  ApprovalDecision,
  ApprovalReplyRequestBody,
  ApprovalReplyResult,
  ApprovalRequestContext,
} from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { widgetThemeStyle } from '@/lib/widgetTheme'
import {
  fmt,
  normalizeReplyLocale,
  pickReplyBundle,
  REPLY_LOCALES,
  type ApprovalReplyBundle,
  type ReplyLocale,
} from './approvalReplyStrings'

/**
 * Hotel room-request confirm page (landr-em0r.9), rendered at
 * /reply/{token}/{intent}. Reached ONLY by following one of the three
 * action buttons in the `hotel_request` email — a receptionist, not an
 * authenticated user.
 *
 * ⚠️ PREFETCHER SAFETY IS THE POINT OF THIS PAGE. Outlook Safe Links and
 * Gmail anti-phishing scanners GET every URL in an email (real incident
 * landr-sgnd 2026-05-21, same rationale as CancelPage). The ONE mount-time
 * effect below calls getApprovalRequest — READ ONLY — and nothing else.
 * submitApprovalReply is called from exactly one place: the confirm
 * button's onClick handler. Do not add any effect that mutates on mount.
 *
 * State machine (mirrors CancelPage.tsx's shape, extended for the extra
 * server-side states this page must render as named cards rather than a
 * bare error — epic decision (e)):
 *   'loading'    — GET in flight (initial load, or after "Try again" on a
 *                   fetch failure).
 *   'form'       — GET succeeded; what renders depends on context.state:
 *                    'open'                → the editable reply form
 *                    'answered'            → recorded-answer card with a
 *                                             "Change my answer" button
 *                                             that reveals the same form
 *                                             pre-set to the current decision
 *                    'closed_confirmed' | 'closed_cancelled' |
 *                    'superseded' | 'expired' → a read-only named card
 *   'submitting' — POST in flight (including the one silent 422 retry);
 *                   all controls disabled.
 *   'success'    — POST succeeded; confirmation card + "Change my answer".
 *   'error'      — GET rejected, or POST failed (after the retry, if any).
 *                   Opaque copy — never leaks status or booking details.
 *                   "Try again" re-fetches on a fetch error, or returns to
 *                   the form WITHOUT calling the API on a submit error
 *                   (mirrors CancelPage.tsx).
 */

type Status = 'loading' | 'form' | 'submitting' | 'success' | 'error'
type ErrorSource = 'fetch' | 'submit'

interface Props {
  token: string
  intent?: 'yes' | 'no' | 'changes'
}

const INTENT_TO_DECISION: Record<'yes' | 'no' | 'changes', ApprovalDecision> = {
  yes: 'confirmed',
  no: 'declined',
  changes: 'confirmed_with_changes',
}

const REASON_CHIP_KEYS = [
  'reasonChipFullyBooked',
  'reasonChipDatesNotPossible',
  'reasonChipGroupTooLarge',
  'reasonChipOther',
] as const

function decisionLabel(bundle: ApprovalReplyBundle, decision: ApprovalDecision): string {
  if (decision === 'confirmed') return bundle.optionConfirmedTitle
  if (decision === 'declined') return bundle.optionDeclinedTitle
  return bundle.optionChangesTitle
}

function formatDate(iso: string, locale: ReplyLocale): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

function isInvalidNonceError(err: unknown): boolean {
  return (
    err instanceof HttpError &&
    err.status === 422 &&
    err.detail === 'invalid_confirm_nonce'
  )
}

function readLangParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('lang')
}

export function ApprovalReplyPage({ token, intent }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorSource, setErrorSource] = useState<ErrorSource | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [context, setContext] = useState<ApprovalRequestContext | null>(null)
  const [confirmNonce, setConfirmNonce] = useState<string>('')
  const [lastResult, setLastResult] = useState<ApprovalReplyResult | null>(null)

  // 'editing' toggles the 'answered' read-only summary → the editable form.
  const [editing, setEditing] = useState(false)

  // ?lang= override wins over the GET's `locale` field, per epic decision (g).
  const [langOverride, setLangOverride] = useState<string | null>(() => readLangParam())

  // Form fields. Seeded once the GET resolves (see the mount effect below);
  // defaults here only matter for the brief instant before that.
  const [decision, setDecision] = useState<ApprovalDecision>(
    () => (intent ? INTENT_TO_DECISION[intent] : 'confirmed'),
  )
  const [comment, setComment] = useState('')
  const [responderName, setResponderName] = useState('')

  const seedFormFromContext = useCallback(
    (data: ApprovalRequestContext) => {
      if (data.current_response) {
        setDecision(data.current_response.decision)
        setComment(data.current_response.comment ?? '')
        setResponderName(data.current_response.responder_name ?? '')
      } else if (intent) {
        setDecision(INTENT_TO_DECISION[intent])
      }
    },
    [intent],
  )

  // ── Mount-time (and "try again" after a fetch failure) read-only GET. ──
  // Exactly one call, read-only, no state mutation on the API side. Never
  // fires again on its own — re-fetching only happens via loadAttempt
  // (explicit user click) or the silent 422 retry inside onConfirm below.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getApprovalRequest(token)
        if (cancelled) return
        setContext(data)
        setConfirmNonce(data.confirm_nonce)
        seedFormFromContext(data)
        setStatus('form')
      } catch {
        if (!cancelled) {
          setErrorSource('fetch')
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // token is stable for the lifetime of this component; seedFormFromContext
    // only changes if `intent` changes, which it also can't post-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadAttempt])

  const locale = normalizeReplyLocale(langOverride ?? context?.locale ?? 'en')
  const t = pickReplyBundle(locale)

  const onConfirm = async () => {
    if (!context) return
    setStatus('submitting')
    setErrorSource(null)
    const trimmedComment = comment.trim()
    const body: ApprovalReplyRequestBody = {
      decision,
      comment: trimmedComment ? trimmedComment : null,
      responder_name: responderName.trim() ? responderName.trim() : null,
      confirm_nonce: confirmNonce,
    }
    try {
      const result = await submitApprovalReply(token, body)
      setLastResult(result)
      setEditing(false)
      setStatus('success')
    } catch (err) {
      if (isInvalidNonceError(err)) {
        // Silent re-GET + one retry (epic section 7 / "receptionist left the
        // tab open >15 min" is the common case) — no status flip, no
        // user-visible error unless the retry ALSO fails.
        try {
          const fresh = await getApprovalRequest(token)
          setContext(fresh)
          setConfirmNonce(fresh.confirm_nonce)
          const retryBody: ApprovalReplyRequestBody = {
            ...body,
            confirm_nonce: fresh.confirm_nonce,
          }
          const result = await submitApprovalReply(token, retryBody)
          setLastResult(result)
          setEditing(false)
          setStatus('success')
          return
        } catch {
          setErrorSource('submit')
          setStatus('error')
          return
        }
      }
      setErrorSource('submit')
      setStatus('error')
    }
  }

  const onTryAgain = () => {
    if (errorSource === 'fetch') {
      setStatus('loading')
      setLoadAttempt((n) => n + 1)
    } else {
      // Submit error: return to the form WITHOUT re-calling the API
      // (mirrors CancelPage.tsx) — the fields the hotel already filled in
      // are preserved.
      setErrorSource(null)
      setStatus('form')
    }
  }

  // Deliberately does NOT re-seed decision/comment/responderName from
  // `context` here: those local fields already hold the right values —
  // either from the initial GET's seedFormFromContext call (the ordinary
  // 'answered' → edit path), or from whatever was just submitted (the
  // success-card → edit-again path, where `context` is stale relative to
  // the answer that was just recorded). Re-seeding from `context` in the
  // latter case would silently discard the just-submitted answer and reset
  // the form to the URL's original intent instead.
  const onChangeAnswer = () => {
    setEditing(true)
  }

  const onSwitchLang = (lang: ReplyLocale) => {
    setLangOverride(lang)
  }

  const busy = status === 'submitting'
  const commentRequired = decision === 'confirmed_with_changes'
  const confirmDisabled = busy || (commentRequired && comment.trim().length < 3)

  const themeStyle = context
    ? widgetThemeStyle({ theme: null, primary_color: context.operator.primary_color })
    : {}

  // ── Loading ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Card data-testid="reply-loading">
        <CardHeader>
          <CardTitle>{t.loadingTitle}</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  // ── Error (opaque — never leaks status/booking details) ────────────────
  if (status === 'error') {
    return (
      <Card data-testid="reply-error">
        <CardHeader>
          <CardTitle>{t.errorTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{t.errorBody}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onTryAgain}>
              {t.tryAgain}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!context) {
    // Unreachable in practice (status is only 'form'/'submitting'/'success'
    // once context is set), but keeps TypeScript's control-flow narrowing
    // honest below without a non-null assertion.
    return null
  }

  const { operator, booking, responder } = context

  // ── Terminal, read-only named cards (epic decision e) ───────────────────
  if (context.state === 'expired') {
    return (
      <TerminalCard
        testId="reply-expired"
        style={themeStyle}
        operator={operator}
        title={t.expiredTitle}
        body={fmt(t.expiredBody, { phone: operator.phone ?? '—' })}
      />
    )
  }
  if (context.state === 'superseded') {
    return (
      <TerminalCard
        testId="reply-superseded"
        style={themeStyle}
        operator={operator}
        title={t.supersededTitle}
        body={fmt(t.supersededBody, {
          operator: operator.name,
          phone: operator.phone ?? '—',
        })}
      />
    )
  }
  if (context.state === 'closed_confirmed') {
    return (
      <TerminalCard
        testId="reply-closed-confirmed"
        style={themeStyle}
        operator={operator}
        title={t.closedConfirmedTitle}
        body={fmt(t.closedConfirmedBody, { operator: operator.name })}
      />
    )
  }
  if (context.state === 'closed_cancelled') {
    return (
      <TerminalCard
        testId="reply-closed-cancelled"
        style={themeStyle}
        operator={operator}
        title={t.closedCancelledTitle}
        body={t.closedCancelledBody}
      />
    )
  }

  // ── Success (just submitted) ────────────────────────────────────────────
  if (status === 'success' && !editing) {
    return (
      <Card data-testid="reply-success" style={themeStyle}>
        <OperatorHeader operator={operator} />
        <CardHeader>
          <CardTitle>{t.successTitle}</CardTitle>
          <CardDescription>
            {lastResult?.already_recorded
              ? t.successAlreadyRecorded
              : fmt(t.successBody, { operator: operator.name })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {decisionLabel(t, lastResult?.decision ?? decision)}
            {comment ? ` — “${comment}”` : ''}
          </p>
          <Button type="button" variant="outline" onClick={onChangeAnswer}>
            {t.changeAnswerButton}
          </Button>
        </CardContent>
        <LanguageSwitcher active={locale} onSwitch={onSwitchLang} t={t} />
      </Card>
    )
  }

  // ── 'answered', not currently editing: read-only recorded-answer card ──
  if (context.state === 'answered' && context.current_response && !editing) {
    const cr = context.current_response
    return (
      <Card data-testid="reply-answered" style={themeStyle}>
        <OperatorHeader operator={operator} />
        <CardHeader>
          <CardTitle>{t.answeredTitle}</CardTitle>
          <CardDescription>
            {fmt(t.answeredBody, {
              operator: operator.name,
              decision: decisionLabel(t, cr.decision),
              date: formatDate(cr.responded_at, locale),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cr.comment && <p className="text-sm">“{cr.comment}”</p>}
          <Button type="button" variant="outline" onClick={onChangeAnswer}>
            {t.changeAnswerButton}
          </Button>
        </CardContent>
        <LanguageSwitcher active={locale} onSwitch={onSwitchLang} t={t} />
      </Card>
    )
  }

  // ── The form itself (state 'open', or 'answered' + editing) ────────────
  return (
    <Card data-testid="reply-form" style={themeStyle}>
      <OperatorHeader operator={operator} />
      <CardHeader>
        <CardTitle>
          {t.pageTitle} — {booking.reference}
        </CardTitle>
        <CardDescription>
          {t.requestRefLabel}: {context.request_ref}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t.checkInLabel}</dt>
          <dd>{formatDate(booking.check_in, locale)}</dd>
          <dt className="text-muted-foreground">{t.checkOutLabel}</dt>
          <dd>{formatDate(booking.check_out, locale)}</dd>
          <dt className="text-muted-foreground">{t.nightsLabel}</dt>
          <dd>{booking.nights}</dd>
          <dt className="text-muted-foreground">{t.guestsLabel}</dt>
          <dd>{booking.guests_count}</dd>
          <dt className="text-muted-foreground">{t.hotelLabel}</dt>
          <dd>{responder.location_name}</dd>
        </dl>

        {booking.room_lines.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold">{t.roomsLabel}</p>
            <ul className="flex flex-col gap-0.5 text-sm">
              {booking.room_lines.map((rl, i) => (
                <li key={i}>
                  {rl.qty} × {rl.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Three large stacked option cards. The URL's intent is only a
            pre-selection — every option stays freely clickable. */}
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.pageTitle}>
          <OptionCard
            selected={decision === 'confirmed'}
            label={t.optionConfirmedTitle}
            disabled={busy}
            onClick={() => setDecision('confirmed')}
          />
          <OptionCard
            selected={decision === 'declined'}
            label={t.optionDeclinedTitle}
            disabled={busy}
            onClick={() => setDecision('declined')}
          />
          <OptionCard
            selected={decision === 'confirmed_with_changes'}
            label={t.optionChangesTitle}
            disabled={busy}
            onClick={() => setDecision('confirmed_with_changes')}
          />
        </div>

        {decision === 'declined' && (
          <div className="flex flex-wrap gap-2">
            {REASON_CHIP_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => setComment(t[key])}
                className="rounded-full border px-3 py-1 text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                {t[key]}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reply-comment">{t.commentLabel}</Label>
          <textarea
            id="reply-comment"
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              commentRequired ? t.commentPlaceholderChanges : t.commentPlaceholderDefault
            }
            rows={3}
            className="w-full min-w-0 rounded-md border border-input bg-surface-page px-3 py-2 text-base shadow-well outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          {commentRequired && (
            <p className="text-xs text-muted-foreground">{t.commentRequiredHint}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reply-name">{t.nameLabel}</Label>
          <Input
            id="reply-name"
            value={responderName}
            disabled={busy}
            onChange={(e) => setResponderName(e.target.value)}
            placeholder={t.namePlaceholder}
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={confirmDisabled}
          onClick={() => {
            void onConfirm()
          }}
        >
          {busy ? t.confirmButtonBusy : t.confirmButton}
        </Button>
      </CardContent>
      <LanguageSwitcher active={locale} onSwitch={onSwitchLang} t={t} />
    </Card>
  )
}

// ── Small presentational helpers ──────────────────────────────────────────

/**
 * Operator branding header. Renders the logo AND the operator name as
 * visible text — never just alt text — because this page is reached from
 * an unsolicited emailed action link: a hotel receptionist recognising the
 * sender by name/logo is the phishing-resistance signal (epic decision g).
 */
function OperatorHeader({
  operator,
}: {
  operator: { name: string; logo_url: string | null }
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-2">
      {operator.logo_url && (
        <img
          src={operator.logo_url}
          alt={operator.name}
          className="h-10 w-auto object-contain"
        />
      )}
      <p className="text-sm font-semibold text-muted-foreground">{operator.name}</p>
    </div>
  )
}

function OptionCard({
  selected,
  label,
  disabled,
  onClick,
}: {
  selected: boolean
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-input hover:bg-accent'
      }`}
    >
      {label}
    </button>
  )
}

function TerminalCard({
  testId,
  style,
  operator,
  title,
  body,
}: {
  testId: string
  style: CSSProperties
  operator: { name: string; logo_url: string | null }
  title: string
  body: string
}) {
  return (
    <Card data-testid={testId} style={style}>
      <OperatorHeader operator={operator} />
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{body}</p>
      </CardContent>
    </Card>
  )
}

function LanguageSwitcher({
  active,
  onSwitch,
  t,
}: {
  active: ReplyLocale
  onSwitch: (lang: ReplyLocale) => void
  t: ApprovalReplyBundle
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 text-xs text-muted-foreground">
      <span className="sr-only">{t.languageSwitcherLabel}</span>
      {REPLY_LOCALES.map((lang, i) => (
        <span key={lang} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={() => onSwitch(lang)}
            aria-current={active === lang}
            className={active === lang ? 'font-semibold underline' : 'hover:underline'}
          >
            {lang.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  )
}
