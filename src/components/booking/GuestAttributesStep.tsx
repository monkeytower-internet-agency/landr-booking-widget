import { useState } from 'react'
import type { FlowGuestAttribute } from '@/api/flowTypes'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { browserLocale } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { ContinueAction } from './ContinueAction'
import type { CompanionDetails, ParticipantDetails } from './detailsTypes'
import {
  applyAttributes,
  attributeBounds,
  attributeLabel,
  checkAttribute,
  guestName,
  initialText,
  unansweredCount,
  type AttributeInputs,
  type GuestLike,
} from './guestAttributes'
import { NextAction } from './NextAction'
import { StepBackButton } from './StepBackButton'

interface Props {
  productName: string
  /** The attributes to ask, in the order to show them. */
  attributes: readonly FlowGuestAttribute[]
  participants: ParticipantDetails[]
  companions: CompanionDetails[]
  onBack?: () => void
  onConfirm: (participants: ParticipantDetails[], companions: CompanionDetails[]) => void
}

/**
 * 'About your guests': one input per guest per attribute the product (and the
 * offers that can be shown for it) asks for. Shown once, right after the party
 * step; skipped by the caller when nothing is asked. Prefilled from what the
 * party step already knows (the roster age).
 */
export function GuestAttributesStep({
  productName,
  attributes,
  participants,
  companions,
  onBack,
  onConfirm,
}: Props) {
  const locale = browserLocale()
  const guests: GuestLike[] = [...participants, ...companions]
  const [inputs, setInputs] = useState<AttributeInputs>({})
  const [touched, setTouched] = useState<Record<string, true>>({})

  const text = (i: number, key: string): string => inputs[i]?.[key] ?? initialText(guests[i]!, key)
  const set = (i: number, key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [i]: { ...(prev[i] ?? {}), [key]: value } }))
    setTouched((prev) => ({ ...prev, [`${i}:${key}`]: true }))
  }

  const missing = unansweredCount(attributes, guests, inputs)
  const ready = missing === 0

  const confirm = () => {
    if (!ready) return
    onConfirm(
      participants.map((p, i) => applyAttributes(p, attributes, inputs[i])),
      companions.map((c, j) => applyAttributes(c, attributes, inputs[participants.length + j])),
    )
  }

  return (
    <Card data-testid="guest-attributes-step">
      {onBack ? <StepBackButton onBack={onBack} /> : null}
      <CardHeader>
        <CardTitle>{tr('guestAttrsTitle', locale)}</CardTitle>
        <CardDescription>
          {productName} · {tr('guestAttrsIntro', locale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <NextAction active={!ready} cue={tr('guestAttrsCue', locale)}>
          <ul className="flex flex-col gap-4">
            {guests.map((guest, i) => (
              <li key={i} className="flex flex-col gap-2" data-testid={`guest-attrs-guest-${i}`}>
                <span className="text-sm font-medium">
                  {guestName(guest, i, (n) => fmt(tr('guestAttrsFallback', locale), { n }))}
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {attributes.map((def) => {
                    const value = text(i, def.key)
                    const checked = checkAttribute(def, value)
                    const showProblem =
                      touched[`${i}:${def.key}`] === true && checked.problem !== undefined
                    const id = `guest-attr-${i}-${def.key}`
                    const [lo, hi] = attributeBounds(def)
                    const label = attributeLabel(def, locale)
                    return (
                      <div key={def.key} className="flex flex-col gap-1">
                        <label htmlFor={id} className="text-xs text-muted-foreground">
                          {label}
                          {def.unit ? ` (${def.unit})` : ''}
                        </label>
                        {def.value_type === 'choice' ? (
                          <select
                            id={id}
                            data-testid={id}
                            value={value}
                            aria-invalid={showProblem ? true : undefined}
                            onChange={(e) => set(i, def.key, e.target.value)}
                            className="border-input bg-surface-page h-9 rounded-md border px-2 text-sm"
                          >
                            <option value="">{tr('guestAttrsChoose', locale)}</option>
                            {(def.choices ?? []).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={id}
                            data-testid={id}
                            type={def.value_type === 'text' ? 'text' : 'number'}
                            inputMode={def.value_type === 'integer' ? 'numeric' : def.value_type === 'number' ? 'decimal' : undefined}
                            min={lo ?? undefined}
                            max={hi ?? undefined}
                            step={def.value_type === 'integer' ? 1 : def.value_type === 'number' ? 'any' : undefined}
                            maxLength={def.value_type === 'text' ? 64 : undefined}
                            value={value}
                            aria-invalid={showProblem ? true : undefined}
                            onChange={(e) => set(i, def.key, e.target.value)}
                          />
                        )}
                        {showProblem ? (
                          <span className="text-xs text-destructive" role="alert">
                            {lo !== null && hi !== null && checked.problem === 'range'
                              ? fmt(tr('guestAttrsRange', locale), { min: lo, max: hi })
                              : tr('guestAttrsInvalid', locale)}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </NextAction>
        <ContinueAction
          ready={ready}
          reason={
            ready
              ? tr('guestAttrsOk', locale)
              : fmt(tr('guestAttrsMissing', locale), { count: missing })
          }
          reasonId="guest-attrs-gate"
          onContinue={confirm}
          data-testid="guest-attrs-submit"
        />
      </CardContent>
    </Card>
  )
}
