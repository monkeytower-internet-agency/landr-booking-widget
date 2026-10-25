import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product } from '@/api/types'
import {
  fileProblem,
  waiverText,
  type VerificationInput,
} from './verification'
import { verificationStrings } from './verificationStrings'

interface Props {
  /** The booked products that require verification (their waiver text is shown). */
  products: Array<Pick<Product, 'waiver_text_localized'>>
  value: VerificationInput
  onChange: (next: VerificationInput) => void
  locale?: string
  disabled?: boolean
}

/**
 * Documents + waiver for a registration the organizer verifies: licence and
 * insurance files, the waiver text, a typed-name signature and the accept box.
 * Controlled; the parent gates its submit on `verificationReady(value)`.
 */
export function VerificationFields({ products, value, onChange, locale, disabled }: Props) {
  const t = verificationStrings(locale)
  const texts = Array.from(
    new Set(products.map((p) => waiverText(p, locale)).filter((x): x is string => x !== null)),
  )

  const fileRow = (kind: 'licence' | 'insurance', label: string) => {
    const file = value[kind]
    const problem = file ? fileProblem(file) : null
    const id = `verification-${kind}`
    return (
      <div className="flex flex-col gap-1" data-testid={`verification-${kind}-row`}>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          disabled={disabled}
          data-testid={id}
          onChange={(e) => onChange({ ...value, [kind]: e.target.files?.[0] ?? null })}
        />
        <p className="text-xs text-muted-foreground">
          {file ? file.name : t.fileHint}
        </p>
        {problem ? (
          <p className="text-xs text-destructive" role="alert" data-testid={`${id}-problem`}>
            {problem === 'size' ? t.fileTooLarge : t.fileWrongType}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border bg-surface-raised p-3"
      data-testid="verification-fields"
    >
      <div>
        <h3 className="text-sm font-semibold">{t.heading}</h3>
        <p className="text-xs text-muted-foreground">{t.intro}</p>
      </div>
      {fileRow('licence', t.licenceLabel)}
      {fileRow('insurance', t.insuranceLabel)}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.waiverHeading}</h3>
        <div
          className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-2 text-sm"
          data-testid="verification-waiver-text"
        >
          {texts.length > 0 ? texts.join('\n\n') : t.waiverFallback}
        </div>
        <Label htmlFor="verification-signature">{t.signatureLabel}</Label>
        <Input
          id="verification-signature"
          autoComplete="name"
          placeholder={t.signaturePlaceholder}
          value={value.signature}
          disabled={disabled}
          data-testid="verification-signature"
          onChange={(e) => onChange({ ...value, signature: e.target.value })}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.accepted}
            disabled={disabled}
            data-testid="verification-accept"
            onChange={(e) => onChange({ ...value, accepted: e.target.checked })}
          />
          <span>{t.acceptLabel}</span>
        </label>
      </div>
    </section>
  )
}
