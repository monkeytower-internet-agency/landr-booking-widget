/**
 * "Add more to this booking" on the review step: the operator's other
 * bookable products, each added as one more line of the SAME booking with the
 * main line's dates inherited (rules in crossSell.ts). Time-slot and course
 * products open their own small picker inline, prefilled to the main date.
 * Every added line's availability is checked here (the existing availability
 * reads); an unavailable day is shown on the line, never silently dropped,
 * and blocks Confirm until the customer edits or removes it.
 */
import { InlineGuestAges } from './InlineGuestAges'
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { getAvailability, getFixedDateWindows, getProductFlow, listProducts } from '@/api/client'
import type { FormResponseEntry, ProductFlowResponse } from '@/api/flowTypes'
import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import { pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import {
  bookingLanguageOffer,
  crossSellCandidates,
  crossSellExclusion,
  inheritLine,
  languagesCover,
  lineNeeds,
  freeUnitsFor,
  freeUnitsOfSeats,
  maxQuantityFor,
  type CrossSellContext,
  type GuestAgeEntry,
  type InlineModuleState,
  lineIssue,
  preferredWindow,
  seatsForLine,
  unavailableDaysFor,
  withWindow,
  type ExtraLine,
} from './crossSell'
import { CustomFormStep } from './CustomFormStep'
import { formatDayLabel } from './dateLabel'
import { LanguageStep } from './LanguageStep'
import type { ParticipantLanguageMap } from './participantLanguages'
import { PickupLocationPicker } from './PickupLocationPicker'
import type { FormPersonSource } from './formScopes'
import { toHHMM } from './slotKey'

interface Props {
  operatorToken: string
  previewToken?: string
  inviteToken?: string
  /** Product ids already in the cart (main line, rooms, add-ons). */
  cartProductIds: string[]
  /** The main line's booked days (a slot's date, a stay's nights). */
  mainDays: string[]
  /** Seats the party takes (participants + held invitees). */
  partySize: number
  lines: ExtraLine[]
  onLinesChange: Dispatch<SetStateAction<ExtraLine[]>>
  /** Operator curation: offer only these products (empty/absent = all eligible). */
  allowedProductIds?: string[]
  locale: string
  /** What the main flow already captured (languages, forms, pickup). */
  context: CrossSellContext
  /**
   * The modules an added product needs and the main flow did not cover
   * (guide language, custom forms, pickup point) are rendered inline on its
   * line; what the customer answers there lives in the booking form.
   */
  modules: InlineModules
}

export interface InlineModules {
  state: InlineModuleState
  /** Raw answers of the inline forms by form key, for re-editing. */
  formAnswers: Readonly<Record<string, Record<string, unknown>>>
  /** Participants' display labels (the language board's rows). */
  participantLabels: string[]
  participants: readonly FormPersonSource[]
  companions: readonly FormPersonSource[]
  onLanguages: (assignment: ParticipantLanguageMap) => void
  onForm: (entry: FormResponseEntry, raw: Record<string, unknown>) => void
  onPickup: (locationId: string) => void
  onAges: (ages: Record<number, GuestAgeEntry>) => void
}

function slotFree(s: AvailabilitySlot, need: number): boolean {
  return s.status !== 'closed' && s.activity_bookable !== false && s.available_seats >= need
}

export function AddMoreProducts({
  operatorToken,
  previewToken,
  inviteToken,
  cartProductIds,
  mainDays,
  partySize,
  lines,
  onLinesChange,
  allowedProductIds,
  locale,
  context,
  modules,
}: Props) {
  const [catalogue, setCatalogue] = useState<Product[]>([])
  // Each candidate's own flow (custom forms); undefined while loading.
  const [flows, setFlows] = useState<Record<string, ProductFlowResponse | null>>({})
  const [slotsByKey, setSlotsByKey] = useState<Record<string, AvailabilitySlot[]>>({})
  const [windowsByKey, setWindowsByKey] = useState<Record<string, FixedDateWindow[]>>({})
  // Inline modules the customer re-opened with "Change" (ids: language,
  // pickup, form:<key>).
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set())
  const inflight = useRef(new Set<string>())
  const flowsRef = useRef<Record<string, null>>({})

  // Free units for the quantity cap: slot / window lines read the picked row.
  const capFree = (l: ExtraLine): number | null => {
    const need = seatsForLine(l, partySize)
    if (l.mode === 'slot') {
      return l.slot ? freeUnitsOfSeats(l.slot.available_seats, need) : null
    }
    if (l.mode === 'window') {
      const w = (windowsByKey[l.key] ?? []).find((x) => x.id === l.windowId)
      return w ? freeUnitsOfSeats(w.capacity - w.capacity_reserved, need) : null
    }
    return l.freeUnits ?? null
  }

  useEffect(() => {
    let live = true
    listProducts(operatorToken, previewToken ? { previewToken } : undefined)
      .then((products) => {
        if (live) setCatalogue(products)
      })
      .catch(() => {
        /* no catalogue, no cross-sell: the booking itself is unaffected */
      })
    return () => {
      live = false
    }
  }, [operatorToken, previewToken])

  // Only products that could be offered need their flow (never the cart's own).
  const flowIds = crossSellCandidates(catalogue, cartProductIds)
    .map((p) => p.product_id)
    .join(',')
  useEffect(() => {
    for (const id of flowIds ? flowIds.split(',') : []) {
      if (id in flowsRef.current) continue
      flowsRef.current[id] = null
      getProductFlow(operatorToken, id)
        .then((flow) => setFlows((m) => ({ ...m, [id]: flow })))
        .catch(() => setFlows((m) => ({ ...m, [id]: null })))
    }
  }, [flowIds, operatorToken])

  // Availability for every line marked `checking` (set by the add / edit
  // handlers below). One request per line state; a stale answer is dropped.
  useEffect(() => {
    for (const line of lines) {
      if (!line.checking) continue
      const sig = `${line.key}|${line.days.join(',')}`
      if (inflight.current.has(sig)) continue
      inflight.current.add(sig)
      const need = seatsForLine(line, partySize)
      const settle = (patch: Partial<ExtraLine>) =>
        onLinesChange((prev) =>
          prev.map((l) =>
            l.key === line.key && `${l.key}|${l.days.join(',')}` === sig
              ? { ...l, ...patch, checking: false }
              : l,
          ),
        )
      const done = () => inflight.current.delete(sig)
      if (line.mode === 'window') {
        getFixedDateWindows(line.product.product_id)
          .then((all) => {
            const open = all.filter((w) => w.capacity - w.capacity_reserved >= need)
            setWindowsByKey((m) => ({ ...m, [line.key]: open }))
            const pick = line.windowId ? null : preferredWindow(open, mainDays)
            settle(pick ? withWindow(line, pick) : {})
          })
          .catch(() => settle({}))
          .finally(done)
        continue
      }
      if (line.days.length === 0) {
        settle({ unavailableDays: [] })
        done()
        continue
      }
      const sorted = [...line.days].sort()
      getAvailability(line.product.product_id, sorted[0], sorted[sorted.length - 1], inviteToken)
        .then((slots) => {
          if (line.mode === 'slot') {
            const day = slots.filter((s) => s.date === sorted[0])
            setSlotsByKey((m) => ({ ...m, [line.key]: day }))
            const picked = line.slot
            const stillFree =
              picked !== null &&
              day.some(
                (s) =>
                  s.availability_id === picked.availability_id &&
                  s.start_time === picked.start_time &&
                  slotFree(s, need),
              )
            settle({
              slot: stillFree ? line.slot : null,
              unavailableDays: day.length > 0 && !day.some((s) => slotFree(s, need)) ? [sorted[0]] : [],
            })
          } else {
            settle({
              unavailableDays: unavailableDaysFor(slots, sorted, need),
              freeUnits: freeUnitsFor(slots, sorted, need),
            })
          }
        })
        // A failed read never blocks: the submit re-checks every line.
        .catch(() => settle({ unavailableDays: [], freeUnits: null }))
        .finally(done)
    }
  }, [lines, partySize, mainDays, inviteToken, onLinesChange])

  // The cap can fall after a re-check (fewer free units, smaller party):
  // pull the quantity down to it.
  const clampKey = lines
    .map((l) => `${l.key}:${l.quantity}:${l.freeUnits ?? ''}:${l.slot?.available_seats ?? ''}:${l.windowId ?? ''}`)
    .join('|')
  useEffect(() => {
    onLinesChange((prev) => {
      let changed = false
      const next = prev.map((l) => {
        const cap = maxQuantityFor(l, partySize, capFree(l))
        if (l.quantity > cap) {
          changed = true
          return { ...l, quantity: cap }
        }
        return l
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampKey, partySize, windowsByKey])

  const taken = [...cartProductIds, ...lines.map((l) => l.product.product_id)]
  // A product shares no guide language with the booking: not offered
  // (crossSellExclusion); one whose flow is still loading waits. Its own
  // language / form / pickup modules render inline on its line.
  const allowed = allowedProductIds && allowedProductIds.length > 0 ? new Set(allowedProductIds) : null
  const candidates = crossSellCandidates(catalogue, taken).filter(
    (p) =>
      (!allowed || allowed.has(p.product_id)) &&
      p.product_id in flows &&
      crossSellExclusion(p, context, lines) === null,
  )
  const needsByLine = lineNeeds(lines, context)
  const languageOffer = bookingLanguageOffer(context.mainLanguages, lines)
  const languageDone =
    languageOffer !== null &&
    languagesCover(modules.state.languages ?? {}, context.participantCount, languageOffer)
  const setEditingId = (id: string, on: boolean) =>
    setEditing((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  // One-next-action rule: only the first module still being answered paints
  // the accent ring and "Next:" cue; later open ones sit quiet until their
  // turn, so the review step never shows several competing rings.
  let openEditors = 0
  const QUIET =
    '[&_[data-next-action=active]]:bg-transparent [&_[data-next-action=active]]:p-0 [&_[data-next-action=active]]:ring-0 [&_[data-testid=next-action-cue]]:hidden'
  const moduleRow = (
    id: string,
    title: string,
    done: boolean,
    editor: ReactNode,
  ) =>
    done && !editing.has(id) ? (
      <div
        key={id}
        data-testid={`add-more-module-${id}`}
        className="flex items-center justify-between gap-2 text-sm"
      >
        <span>{fmt(tr('addMoreModuleDone', locale), { title })}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(id, true)}>
          {tr('addMoreModuleChange', locale)}
        </Button>
      </div>
    ) : (
      <div
        key={id}
        data-testid={`add-more-module-${id}`}
        className={openEditors++ > 0 ? QUIET : undefined}
      >
        {editor}
      </div>
    )
  if (candidates.length === 0 && lines.length === 0) return null

  const update = (key: string, patch: Partial<ExtraLine>) =>
    onLinesChange((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const name = (p: Product) => pickLocalized(p.name, p.name_localized, locale)

  return (
    <section
      data-testid="add-more-products"
      className="space-y-3 rounded-lg border border-border bg-surface-raised p-4"
    >
      <div>
        <h3 className="text-base font-semibold">{tr('addMoreTitle', locale)}</h3>
        <p className="text-sm text-muted-foreground">{tr('addMoreIntro', locale)}</p>
      </div>

      {lines.map((line) => {
        const issue = lineIssue(line)
        const slots = (slotsByKey[line.key] ?? []).filter((s) =>
          slotFree(s, seatsForLine(line, partySize)),
        )
        const windows = windowsByKey[line.key] ?? []
        const needs = needsByLine[line.key]
        const maxQty = maxQuantityFor(line, partySize, capFree(line))
        const atMax = line.quantity >= maxQty
        return (
          <div
            key={line.key}
            data-testid={`add-more-line-${line.product.product_id}`}
            className="space-y-2 rounded-md border border-border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{name(line.product)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onLinesChange((prev) => prev.filter((l) => l.key !== line.key))}
              >
                {tr('addMoreRemove', locale)}
              </Button>
            </div>

            {line.mode === 'days' || line.mode === 'nights' ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {tr(line.mode === 'nights' ? 'addMoreNights' : 'addMoreDates', locale)}
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  {[...line.days].sort().map((d) => {
                    const bad = line.unavailableDays.includes(d)
                    return (
                      <li
                        key={d}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm ${bad ? 'border-destructive text-destructive' : 'border-border'}`}
                      >
                        {formatDayLabel(d, locale)}
                        <button
                          type="button"
                          aria-label={fmt(tr('addMoreRemoveDay', locale), {
                            date: formatDayLabel(d, locale),
                          })}
                          className="px-1"
                          onClick={() =>
                            update(line.key, {
                              days: line.days.filter((x) => x !== d),
                              checking: true,
                            })
                          }
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {line.mode === 'slot' ? (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  {tr('addMoreDate', locale)}
                  <input
                    type="date"
                    className="rounded border border-border px-2 py-1"
                    value={line.days[0] ?? ''}
                    onChange={(e) =>
                      update(line.key, {
                        days: e.target.value ? [e.target.value] : [],
                        slot: null,
                        checking: Boolean(e.target.value),
                      })
                    }
                  />
                </label>
                {line.days[0] && !line.checking ? (
                  slots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5" role="group">
                      {slots.map((s) => {
                        const on =
                          line.slot?.availability_id === s.availability_id &&
                          line.slot?.start_time === s.start_time
                        return (
                          <Button
                            key={`${s.availability_id ?? ''}${s.start_time ?? ''}`}
                            type="button"
                            size="sm"
                            variant={on ? 'default' : 'outline'}
                            aria-pressed={on}
                            onClick={() => update(line.key, { slot: s })}
                          >
                            {toHHMM(s.start_time) ?? formatDayLabel(s.date, locale)}
                          </Button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">
                      {fmt(tr('addMoreNoTimes', locale), {
                        date: formatDayLabel(line.days[0], locale),
                      })}
                    </p>
                  )
                ) : null}
              </div>
            ) : null}

            {line.mode === 'window' && !line.checking ? (
              windows.length > 0 ? (
                <label className="flex flex-col gap-1 text-sm">
                  {tr('addMorePickWindow', locale)}
                  <select
                    className="rounded border border-border px-2 py-1"
                    value={line.windowId ?? ''}
                    onChange={(e) => {
                      const w = windows.find((x) => x.id === e.target.value)
                      if (w) update(line.key, withWindow(line, w))
                    }}
                  >
                    {line.windowId ? null : <option value="">—</option>}
                    {windows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label ? `${w.label}: ` : ''}
                        {formatDayLabel(w.start_date, locale)} – {formatDayLabel(w.end_date, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-destructive">{tr('addMoreNoWindows', locale)}</p>
              )
            ) : null}

            {line.mode !== 'nights' ? (
            <div className="flex items-center gap-2 text-sm">
              <span>{tr('addMoreQuantity', locale)}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="−"
                disabled={line.quantity <= 1}
                onClick={() => update(line.key, { quantity: Math.max(1, line.quantity - 1) })}
              >
                −
              </Button>
              <span data-testid="add-more-quantity">{line.quantity}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="+"
                disabled={atMax}
                onClick={() => update(line.key, { quantity: line.quantity + 1 })}
              >
                +
              </Button>
              {Number.isFinite(maxQty) ? (
                <span data-testid="add-more-max" className="text-xs text-muted-foreground">
                  {fmt(tr('addMoreMaxQuantity', locale), { max: maxQty })}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {fmt(tr('addMoreForGroup', locale), { count: partySize })}
              </span>
            </div>
            ) : null}

            {needs?.ages ? (
              <InlineGuestAges
                labels={modules.participantLabels}
                value={modules.state.ages ?? {}}
                onChange={modules.onAges}
                locale={locale}
              />
            ) : null}

            {needs && (needs.language || needs.pickup || needs.forms.length > 0) ? (
              <div className="space-y-3">
                {needs.language && languageOffer
                  ? moduleRow(
                      'language',
                      tr('guideLanguageTitle', locale),
                      languageDone,
                      <LanguageStep
                        key={`language-${languageOffer.join(',')}`}
                        embedded
                        productName={name(line.product)}
                        participantNames={modules.participantLabels}
                        offeredLanguages={languageOffer}
                        initialAssignment={modules.state.languages ?? context.participantLanguages}
                        onConfirm={(assignment) => {
                          modules.onLanguages(assignment)
                          setEditingId('language', false)
                        }}
                      />,
                    )
                  : null}
                {needs.pickup
                  ? moduleRow(
                      'pickup',
                      tr('pickupLocationTitle', locale),
                      modules.state.pickupLocationId !== null,
                      <PickupLocationPicker
                        embedded
                        operatorToken={operatorToken}
                        productName={name(line.product)}
                        initialLocationId={modules.state.pickupLocationId}
                        onConfirm={(id) => {
                          modules.onPickup(id)
                          setEditingId('pickup', false)
                        }}
                      />,
                    )
                  : null}
                {needs.forms.map((form) =>
                  moduleRow(
                    `form:${form.key}`,
                    pickLocalized(form.name, form.name_localized, 'en') || form.name,
                    modules.state.formKeys.includes(form.key),
                    <CustomFormStep
                      operatorToken={operatorToken}
                      productId={line.product.product_id}
                      formKey={form.key}
                      productName={name(line.product)}
                      flow={line.flow ?? null}
                      initialAnswers={modules.formAnswers[form.key]}
                      participants={modules.participants}
                      companions={modules.companions}
                      hideCustomerComment
                      submitLabel={tr('addMoreModuleSave', locale)}
                      onConfirm={(entry, raw) => {
                        modules.onForm(entry, raw)
                        setEditingId(`form:${form.key}`, false)
                      }}
                    />,
                  ),
                )}
              </div>
            ) : null}

            {issue === 'checking' ? (
              <p className="text-sm text-muted-foreground">{tr('addMoreChecking', locale)}</p>
            ) : issue === 'unavailable' ? (
              <p className="text-sm text-destructive" role="alert">
                {fmt(tr('addMoreUnavailable', locale), {
                  dates: line.unavailableDays.map((d) => formatDayLabel(d, locale)).join(', '),
                })}
              </p>
            ) : issue === 'needs_time' && slots.length > 0 ? (
              <p className="text-sm text-muted-foreground">{tr('addMorePickTime', locale)}</p>
            ) : issue === 'no_days' ? (
              <p className="text-sm text-destructive">{tr('addMoreNoDays', locale)}</p>
            ) : null}
          </div>
        )
      })}

      {candidates.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {candidates.map((p) => (
            <li key={p.product_id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid={`add-more-candidate-${p.product_id}`}
                onClick={() =>
                  onLinesChange((prev) => [
                    ...prev,
                    {
                      ...inheritLine(p, mainDays, `x-${p.product_id}`, flows[p.product_id] ?? null),
                      checking: true,
                    },
                  ])
                }
              >
                + {name(p)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
