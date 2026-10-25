import { useEffect, useState } from 'react'

import { getVerificationState, uploadVerificationFile } from '@/api/client'
import type { VerificationFileKind, VerificationState } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fileProblem } from './verification'
import { verificationStrings } from './verificationStrings'

interface Props {
  initial: VerificationState
  locale?: string
}

/**
 * Confirmation-screen block for a registration that waits on the organizer:
 * "we'll confirm once verified", which documents arrived, and a retry upload
 * for any that did not. Polls nothing; a re-read happens after each upload and
 * once on mount (the customer may return to this screen late).
 */
export function VerificationStatusPanel({ initial, locale }: Props) {
  const t = verificationStrings(locale)
  const token = initial.upload_token ?? null
  const [state, setState] = useState<VerificationState>(initial)
  const [busy, setBusy] = useState<VerificationFileKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getVerificationState(token)
      .then((fresh) => {
        if (!cancelled) setState((prev) => ({ ...fresh, upload_token: prev.upload_token }))
      })
      .catch(() => {
        // Keep what the submit told us.
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const missing: VerificationFileKind[] = [
    ...(state.licence_uploaded ? [] : (['licence'] as const)),
    ...(state.insurance_uploaded ? [] : (['insurance'] as const)),
  ]

  const upload = async (kind: VerificationFileKind, file: File | undefined) => {
    if (!token || !file) return
    if (fileProblem(file)) {
      setError(fileProblem(file) === 'size' ? t.fileTooLarge : t.fileWrongType)
      return
    }
    setBusy(kind)
    setError(null)
    try {
      const next = await uploadVerificationFile(token, kind, file)
      setState({ ...next, upload_token: token })
    } catch {
      setError(t.uploadFailed)
    } finally {
      setBusy(null)
    }
  }

  const label = (kind: VerificationFileKind) =>
    kind === 'licence' ? t.licenceLabel : t.insuranceLabel

  if (state.status === 'rejected') {
    return (
      <div
        role="status"
        className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        data-testid="verification-rejected"
      >
        <p className="font-medium">{t.rejectedTitle}</p>
        {state.note ? (
          <p className="mt-1">
            {t.rejectedNoteLabel} {state.note}
          </p>
        ) : null}
      </div>
    )
  }

  if (state.status === 'approved') {
    return (
      <p className="text-sm font-medium" data-testid="verification-approved">
        {t.approvedBody}
      </p>
    )
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border bg-surface-raised px-4 py-3 text-sm"
      data-testid="verification-pending"
    >
      <p className="font-medium">{t.pendingTitle}</p>
      <p>{t.pendingBody}</p>
      <ul className="text-xs text-muted-foreground">
        {(['licence', 'insurance'] as const).map((kind) => (
          <li key={kind} data-testid={`verification-status-${kind}`}>
            {label(kind)}:{' '}
            {(kind === 'licence' ? state.licence_uploaded : state.insurance_uploaded)
              ? t.uploadedLabel
              : t.missingLabel}
          </li>
        ))}
      </ul>
      {missing.length > 0 && token ? (
        <div className="flex flex-col gap-2" data-testid="verification-retry">
          <p className="text-xs">{t.needFilesBody}</p>
          {missing.map((kind) => (
            <div key={kind} className="flex flex-col gap-1">
              <Label htmlFor={`verification-retry-${kind}`}>{label(kind)}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`verification-retry-${kind}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  disabled={busy !== null}
                  data-testid={`verification-retry-${kind}`}
                  onChange={(e) => void upload(kind, e.target.files?.[0])}
                />
                {busy === kind ? (
                  <Button type="button" variant="outline" size="sm" disabled>
                    {t.uploading}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert" data-testid="verification-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
