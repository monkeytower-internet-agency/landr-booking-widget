/**
 * DeclarationsStep (landr-sbhz.3) — pre-booking customer eligibility
 * intake for operators that require it (v1: Para42 paragliding school).
 *
 * The customer must:
 *   1. Confirm all eligibility declarations (checkboxes).
 *   2. Select ONE OR MORE spoken languages from the operator's offered list,
 *      and/or fill in a free-text "Other languages spoken" field.
 *
 * Both the declarations and at least one language indication are required
 * before the Confirm button is enabled; the server enforces the same rules
 * as defence-in-depth (public_bookings.py).
 *
 * DESIGN — hardcoded Para42 set with clear extension point:
 * The declaration texts + language list are passed as props so operators
 * can provide their own copy. The App.tsx caller threads through the
 * operator-specific configuration. V1 hardcodes the Para42 set in
 * App.tsx; v2 would fetch operator_declarations from the API.
 *
 * The component is intentionally generic: it doesn't know it is
 * Para42-specific. All copy + language options come from props.
 *
 * landr-87n9.4: upgraded from single-select language to:
 *   - Multi-select checkbox list over languageOptions
 *   - Free-text "Other languages spoken" input
 *   CustomerDeclarations now carries languages: string[] + otherLanguages: string.
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
import { useVariant } from '@/lib/variant'
import { cn } from '@/lib/utils'

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
  /**
   * landr-87n9.4: BCP-47 codes for all selected languages from the offered
   * list. Empty array when none of the offered languages was checked.
   */
  languages: string[]
  /**
   * landr-87n9.4: Free-text field for languages not in the offered list
   * (e.g. "Zulu, Russian"). Empty string when not provided.
   */
  otherLanguages: string
}

interface Props {
  productName: string
  /** Declaration items to render (operator-specific). */
  declarationItems: DeclarationItem[]
  /** Language options for the multi-select checkbox list (operator-specific). */
  languageOptions: LanguageOption[]
  /** Initial values for back-nav restoration. */
  initialDeclarations?: CustomerDeclarations
  onBack: () => void
  onConfirm: (declarations: CustomerDeclarations) => void
}

/**
 * DeclarationsStep — renders the eligibility confirmation checkboxes and a
 * multi-select language section (checkbox list + free-text "other"). All
 * eligibility checkboxes must be checked AND at least one language must be
 * selected (via the list or free-text) before Continue is enabled.
 */
export function DeclarationsStep({
  productName,
  declarationItems,
  languageOptions,
  initialDeclarations,
  onBack,
  onConfirm,
}: Props) {
  const { tokens } = useVariant()
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const item of declarationItems) {
      initial[item.key] = initialDeclarations?.declarations[item.key] === true
    }
    return initial
  })

  // landr-87n9.4: selected languages from the offered list (multi-select).
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    () => new Set(initialDeclarations?.languages ?? []),
  )

  // landr-87n9.4: free-text for languages not in the offered list.
  const [otherLanguages, setOtherLanguages] = useState<string>(
    initialDeclarations?.otherLanguages ?? '',
  )

  const allChecked = declarationItems.every((item) => checked[item.key] === true)
  // At least one language indicated: either a checkbox from the list or a
  // non-empty free-text entry.
  const languageIndicated = selectedLanguages.size > 0 || otherLanguages.trim() !== ''
  const canContinue = allChecked && languageIndicated

  const toggleDeclaration = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const handleContinue = () => {
    if (!canContinue) return
    const declarations: Record<string, true> = {}
    for (const item of declarationItems) {
      declarations[item.key] = true
    }
    onConfirm({
      declarations,
      languages: Array.from(selectedLanguages),
      otherLanguages: otherLanguages.trim(),
    })
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
          <div className="flex flex-col gap-2.5">
            {declarationItems.map((item) => {
              const isChecked = checked[item.key] === true
              return (
                // landr-3mo4: each declaration is a tappable row-card. A
                // confirmed row picks up the shared brand-tint + ring so the
                // customer sees at a glance which boxes are done.
                <div
                  key={item.key}
                  className={cn(
                    'flex items-start gap-3 border p-3 transition-[background-color,border-color]',
                    tokens.optionCardRadius,
                    isChecked
                      ? tokens.optionSelected
                      : 'border-border bg-surface-raised shadow-elev-1',
                  )}
                >
                  <Checkbox
                    id={`decl-${item.key}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleDeclaration(item.key)}
                    data-testid={`decl-checkbox-${item.key}`}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`decl-${item.key}`}
                    className="text-sm leading-snug cursor-pointer"
                  >
                    {item.label}
                  </Label>
                </div>
              )
            })}
          </div>
        </fieldset>

        {/* landr-87n9.4: multi-select language section */}
        <fieldset
          className="flex flex-col gap-3 border-t pt-4"
          data-testid="language-fieldset"
        >
          <legend className="text-sm font-medium">Spoken languages</legend>
          <p className="text-xs text-muted-foreground">
            Select all languages you are comfortable being guided in. You must
            indicate at least one.
          </p>

          {/* Checkbox list — one per offered language */}
          <div className="flex flex-col gap-2" data-testid="language-checkboxes">
            {languageOptions.map((opt) => (
              <div key={opt.code} className="flex items-center gap-3">
                <Checkbox
                  id={`lang-${opt.code}`}
                  checked={selectedLanguages.has(opt.code)}
                  onCheckedChange={() => toggleLanguage(opt.code)}
                  data-testid={`lang-checkbox-${opt.code}`}
                />
                <Label
                  htmlFor={`lang-${opt.code}`}
                  className="text-sm cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>

          {/* Free-text input for languages not in the list */}
          <div className="flex flex-col gap-1.5 mt-1">
            <Label
              htmlFor="decl-other-languages"
              className="text-sm text-muted-foreground"
            >
              Other languages spoken
            </Label>
            <input
              id="decl-other-languages"
              type="text"
              value={otherLanguages}
              onChange={(e) => setOtherLanguages(e.target.value)}
              placeholder="e.g. Zulu, Russian"
              data-testid="other-languages-input"
              className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
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
