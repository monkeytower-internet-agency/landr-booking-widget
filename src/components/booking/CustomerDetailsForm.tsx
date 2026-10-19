/**
 * landr-kcxx5.4 — CustomerDetailsForm: the pending forms of a booking, one
 * CustomFormStep after the other, with ONE final Submit that PUTs everything.
 *
 * Shared by the /details/{token} page and the offer page (where the same
 * component runs inline before Accept). Nothing is sent before the final
 * Submit click, and nothing is mutated on mount (email prefetchers GET links).
 */
import { useMemo, useRef, useState } from 'react'
import {
  conflictErrorCode,
  detailsFieldErrors,
  HttpError,
  putBookingDetails,
} from '@/api/client'
import type {
  CustomerDetails,
  DetailsFieldError,
  DetailsFormResponse,
} from '@/api/customerDetailsTypes'
import type { FormResponseEntry } from '@/api/flowTypes'
import { browserLocale } from '@/lib/locale'
import { CustomFormStep } from './CustomFormStep'
import {
  collectForms,
  entryToDetailsResponse,
  initialAnswersFor,
  rosterSources,
} from './customerDetails'
import { fmtDetails, pickDetailsBundle } from './detailsStrings'

interface Props {
  token: string
  details: CustomerDetails
  /** Replaces "Submit" on the final form (offer page: "Save and accept"). */
  submitLabel?: string
  /** Called once the answers are saved (or were already complete). */
  onSaved: () => void
}

interface Confirmed {
  response: DetailsFormResponse
  raw: Record<string, unknown>
}

export function CustomerDetailsForm({
  token,
  details,
  submitLabel,
  onSaved,
}: Props) {
  const t = pickDetailsBundle(browserLocale())
  const forms = useMemo(() => collectForms(details), [details])
  const roster = useMemo(() => rosterSources(details.people ?? []), [details.people])
  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of details.people ?? []) m.set(p.booking_participant_id, p.display_name)
    return m
  }, [details.people])

  const [index, setIndex] = useState(0)
  const [confirmed, setConfirmed] = useState<Record<string, Confirmed>>({})
  const [problems, setProblems] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  // After a server-side 422 the customer is sent back to the offending form;
  // fixing it should submit again straight away, not walk every form again.
  const [retrying, setRetrying] = useState(false)
  const inFlight = useRef(false)

  const describe = (e: DetailsFieldError): string => {
    const who = e.booking_participant_id ? nameOf.get(e.booking_participant_id) : null
    return who ? `${who}: ${e.message}` : e.message
  }

  const submit = async (all: Record<string, Confirmed>) => {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setProblems([])
    try {
      await putBookingDetails(token, {
        form_responses: forms.map((f) => all[f.form.key].response),
      })
      onSaved()
    } catch (err) {
      const fieldErrors = detailsFieldErrors(err)
      if (fieldErrors) {
        setProblems(fieldErrors.length > 0 ? fieldErrors.map(describe) : [t.saveFailed])
        const first = fieldErrors[0]
        const at = first ? forms.findIndex((f) => f.form.key === first.form_key) : -1
        if (at >= 0) setIndex(at)
        setRetrying(true)
      } else if (conflictErrorCode(err) === 'customer_details_already_complete') {
        onSaved()
      } else if (conflictErrorCode(err) === 'booking_closed') {
        setProblems([t.bookingClosed])
      } else {
        if (!(err instanceof HttpError)) console.error('[landr] putBookingDetails failed', err)
        setProblems([t.saveFailed])
      }
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const onConfirm = (at: number, entry: FormResponseEntry, raw: Record<string, unknown>) => {
    const key = forms[at].form.key
    const next = { ...confirmed, [key]: { response: entryToDetailsResponse(entry, roster), raw } }
    setConfirmed(next)
    const last = at === forms.length - 1
    const allDone = forms.every((f) => next[f.form.key])
    if (last || (retrying && allDone)) {
      void submit(next)
    } else {
      setProblems([])
      setIndex(at + 1)
    }
  }

  if (forms.length === 0) {
    // Pending but no form to show: nothing the customer can answer here.
    return null
  }

  const step = forms[Math.min(index, forms.length - 1)]
  const at = forms.indexOf(step)
  const showLast = at === forms.length - 1 || retrying
  return (
    <div className="flex flex-col gap-3" data-testid="details-form">
      {forms.length > 1 ? (
        <p className="px-1 text-xs text-muted-foreground" data-testid="details-step-counter">
          {fmtDetails(t.stepCounter, { n: String(at + 1), total: String(forms.length) })}
        </p>
      ) : null}
      {problems.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          data-testid="details-problems"
        >
          <p className="font-semibold">{t.problemsTitle}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {saving ? (
        <p className="px-1 text-sm text-muted-foreground" role="status" data-testid="details-saving">
          {t.saving}
        </p>
      ) : null}
      <CustomFormStep
        key={step.form.key}
        operatorToken=""
        productId=""
        formKey={step.form.key}
        productName={step.productName}
        flow={step.flow}
        participants={roster.participants}
        companions={roster.companions}
        initialAnswers={confirmed[step.form.key]?.raw ?? initialAnswersFor(details, step.form.key)}
        hideCustomerComment
        {...(at > 0
          ? {
              onBack: () => {
                setProblems([])
                setIndex(at - 1)
              },
            }
          : {})}
        submitLabel={showLast ? (submitLabel ?? t.submit) : undefined}
        onConfirm={(entry, raw) => onConfirm(at, entry, raw)}
      />
    </div>
  )
}
