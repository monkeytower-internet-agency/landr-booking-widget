/**
 * DeclarationsStep (landr-sbhz.3) — pre-booking customer eligibility
 * intake for operators that require it (v1: Para42 paragliding school).
 *
 * The customer must:
 *   1. Confirm all 4 eligibility declarations (checkboxes).
 *   2. Select their spoken language from the operator's offered list.
 *
 * Both are required before the Confirm button is enabled; the server
 * enforces the same rules as defence-in-depth (public_bookings.py).
 *
 * DESIGN — hardcoded Para42 set with clear extension point:
 * The declaration texts + language list are passed as props so operators
 * can provide their own copy. The App.tsx caller threads through the
 * operator-specific configuration. V1 hardcodes the Para42 set in
 * App.tsx; v2 would fetch operator_declarations from the API.
 *
 * The component is intentionally generic: it doesn't know it is
 * Para42-specific. All copy + language options come from props.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { StepBackButton } from '@/components/booking/StepBackButton'

export interface DeclarationItem {
  /** Stable machine key, stored in customer_declarations JSONB. */
  key: string
  /** Customer-facing label text. */
  label: string
}

export interface LanguageOption {
  /** BCP-47 code sent to the API. */
  code: string
  /** Customer-facing display label. */
  label: string
}

export interface CustomerDeclarations {
  /** Map of key → true for each confirmed declaration. */
  declarations: Record<string, true>
  /** BCP-47 code of the chosen language. */
  language: string
}

interface Props {
  productName: string
  /** Declaration items to render (operator-specific). */
  declarationItems: DeclarationItem[]
  /** Language options for the selector (operator-specific). */
  languageOptions: LanguageOption[]
  /** Initial values for back-nav restoration. */
  initialDeclarations?: CustomerDeclarations
  onBack: () => void
  onConfirm: (declarations: CustomerDeclarations) => void
}

/**
 * DeclarationsStep — renders the eligibility confirmation checkboxes
 * and a language selector. All checkboxes must be checked and a
 * non-empty language must be selected before the Continue button
 * is enabled.
 */
export function DeclarationsStep({
  productName,
  declarationItems,
  languageOptions,
  initialDeclarations,
  onBack,
  onConfirm,
}: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const item of declarationItems) {
      initial[item.key] = initialDeclarations?.declarations[item.key] === true
    }
    return initial
  })

  const [language, setLanguage] = useState<string>(
    initialDeclarations?.language ?? '',
  )

  const allChecked = declarationItems.every((item) => checked[item.key] === true)
  const languageSelected = language !== ''
  const canContinue = allChecked && languageSelected

  const toggleDeclaration = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleContinue = () => {
    if (!canContinue) return
    const declarations: Record<string, true> = {}
    for (const item of declarationItems) {
      declarations[item.key] = true
    }
    onConfirm({ declarations, language })
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Before you book</CardTitle>
        <CardDescription>
          {productName} · please confirm the following before continuing
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Declaration checkboxes */}
        <fieldset className="flex flex-col gap-4" data-testid="declarations-fieldset">
          <legend className="text-sm font-medium">
            Eligibility confirmations
          </legend>
          <p className="text-xs text-muted-foreground">
            All boxes must be checked to proceed.
          </p>
          <div className="flex flex-col gap-3">
            {declarationItems.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                <Checkbox
                  id={`decl-${item.key}`}
                  checked={checked[item.key] === true}
                  onCheckedChange={() => toggleDeclaration(item.key)}
                  data-testid={`decl-checkbox-${item.key}`}
                />
                <Label
                  htmlFor={`decl-${item.key}`}
                  className="text-sm leading-snug cursor-pointer"
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Language selector */}
        <fieldset className="flex flex-col gap-3 border-t pt-4" data-testid="language-fieldset">
          <legend className="text-sm font-medium">Spoken language</legend>
          <p className="text-xs text-muted-foreground">
            Select the language you are comfortable being guided in.
          </p>
          <select
            id="decl-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            data-testid="language-select"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— Select language —</option>
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </fieldset>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            data-testid="declarations-continue"
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
