/**
 * landr-r6e5x.4 — LanguageStep
 *
 * Epic decision D3, as its OWN funnel step: assign every PARTICIPANT to
 * exactly one of the operator's offered guide languages before the booking
 * can be submitted. Non-guiding companions are deliberately never passed to
 * this step (landr-9sjw5, narrowing D3's original "participants and
 * companions alike") — a companion is never briefed by the guide, so there
 * is nothing this board needs to ask them.
 *
 * WHY A STEP AND NOT A FORM FIELD. The API validates `participants[].language`
 * on EVERY public submit — `assert_participant_languages` in
 * `booking_submit_validation.py` runs unconditionally, with no dependence on
 * the operator's configured flow. An earlier revision of this work collected
 * the assignment inside the declarations custom form, which meant every product
 * WITHOUT such a form reached the review screen with no language to send and
 * dead-ended on a 422 the customer could do nothing about. Those products are
 * the common case, not a corner: at review time kayak-demo had none of its 3
 * products on a custom form, and para42 6 of 13. The step therefore runs for
 * every product whose `guide_languages` resolves to a NON-EMPTY list (the gate
 * is per product since landr-p68d2; NULL or absent still falls back to the
 * default set, so those products get the step too). It is SKIPPED for an
 * "any language" product (`guide_languages = []`, landr-pv2r1 E3): the API
 * then treats participant languages as optional (E2), so there is nothing to
 * assign. Skipping it there is intended — do not "fix" it back.
 *
 * It sits BEFORE the custom-form chain so that a flow which also declares a
 * `language` field mirrors this answer rather than asking twice.
 *
 * The board itself (drag / tap / dropdown) lives in ParticipantLanguageBoard;
 * this file is the step frame: the card, the submit gate, and the seeding
 * rules that keep the common cases down to one gesture.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { languageStepCue, languageStepGate, tr } from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import { ContinueAction } from './ContinueAction'
import { CustomerCommentField } from './CustomerCommentField'
import { HelpDisclosure } from './HelpDisclosure'
import { OptionalReveal } from './OptionalReveal'
import { ParticipantLanguageBoard } from './ParticipantLanguageBoard'
import {
  applyLanguageAssignment,
  isLanguageAssignmentComplete,
  memberLabel,
  openLanguageColumns,
  pruneLanguageAssignment,
  unassignedMemberIndices,
  type ParticipantLanguageMap,
} from './participantLanguages'

export interface LanguageStepProps {
  /** Product display name, for the card subtitle. */
  productName: string
  /**
   * Display names for the WHOLE PARTY in the unified index space — guiding
   * participants first (0..P-1), then companions (P..P+C-1).
   */
  participantNames: string[]
  /** Parallel flags marking non-guiding companions, same index space. */
  guestFlags?: boolean[]
  /** The operator's offered guide languages, already normalised. */
  offeredLanguages: string[]
  /** Restored party-index → language map for back-nav re-entry. */
  initialAssignment?: ParticipantLanguageMap
  /**
   * landr-n6ii3: current value of the "Anything we should know?" comment,
   * read straight off App.tsx's bookingDraft.customerComment. Optional
   * (defaults to '' / a no-op) so existing tests need no change.
   */
  customerComment?: string
  onCustomerCommentChange?: (comment: string) => void
  /**
   * landr-8sk6l: the operator form's optional "Other languages spoken" field,
   * asked here beside the board instead of on the later custom-form step. The
   * value lives in App.tsx's draft (the form's own answer slot) and is written
   * live, like the comment. Absent when the product's flow declares no such
   * field — then nothing renders.
   */
  otherLanguages?: {
    label: string
    helpText?: string | null
    maxLength?: number | null
    value: string
    onChange: (value: string) => void
  }
  onBack: () => void
  onConfirm: (assignment: ParticipantLanguageMap) => void
}

/**
 * Seed the board's opening state.
 *
 * With exactly ONE offered language there is no choice to make: putting
 * everybody in it turns the step into a one-tap confirmation instead of a
 * mandatory drag exercise with a single possible answer. Any restored
 * assignment wins over the seed, so a customer who came back never has their
 * own choice overwritten.
 */
function seedAssignment(
  offeredLanguages: readonly string[],
  partyCount: number,
  restored: ParticipantLanguageMap | undefined,
): ParticipantLanguageMap {
  const base = pruneLanguageAssignment(restored ?? {}, offeredLanguages, partyCount)
  if (offeredLanguages.length !== 1) return base
  const only = offeredLanguages[0]!
  const seeded: ParticipantLanguageMap = { ...base }
  for (let i = 0; i < partyCount; i += 1) {
    if (seeded[i] === undefined) seeded[i] = only
  }
  return seeded
}

export function LanguageStep({
  productName,
  participantNames,
  guestFlags = [],
  offeredLanguages,
  initialAssignment,
  customerComment = '',
  onCustomerCommentChange = () => {},
  otherLanguages,
  onBack,
  onConfirm,
}: LanguageStepProps) {
  const partyCount = participantNames.length
  const locale = browserLocale()

  const [rawAssignment, setRawAssignment] = useState<ParticipantLanguageMap>(() =>
    seedAssignment(offeredLanguages, partyCount, initialAssignment),
  )
  const [openedLanguages, setOpenedLanguages] = useState<string[]>([])

  // Pruned at DERIVE time rather than in an effect: the roster can shrink
  // upstream and the offered list can change under a long-lived tab, and
  // either must drop a stale entry without a render loop (setState inside an
  // effect body is an ESLint error in this repo, and the right answer anyway).
  const assignment = useMemo(
    () => pruneLanguageAssignment(rawAssignment, offeredLanguages, partyCount),
    [rawAssignment, offeredLanguages, partyCount],
  )
  const openLanguages = useMemo(
    () => openLanguageColumns(openedLanguages, assignment, offeredLanguages, partyCount),
    [openedLanguages, assignment, offeredLanguages, partyCount],
  )
  const unassignedLabels = useMemo(
    () =>
      unassignedMemberIndices(partyCount, assignment).map((i) =>
        memberLabel(participantNames, i),
      ),
    [partyCount, assignment, participantNames],
  )
  const complete = isLanguageAssignmentComplete(partyCount, assignment)
  // Before the customer has placed anyone the gate is guidance, not a failure —
  // a red validation error on arrival is noise rather than feedback.
  const started = Object.keys(assignment).length > 0

  const openColumn = useCallback((code: string) => {
    setOpenedLanguages((prev) => (prev.includes(code) ? prev : [...prev, code]))
  }, [])

  const handleAssign = useCallback(
    (memberIndex: number, code: string | null) => {
      setRawAssignment((prev) => applyLanguageAssignment(prev, memberIndex, code))
      // Assigning through a dropdown, or emptying a column, must not make the
      // column vanish under the customer: pin it open until they remove it.
      if (code !== null) openColumn(code)
    },
    [openColumn],
  )

  const handleAssignEveryone = useCallback(
    (code: string) => {
      setRawAssignment(() => {
        const next: ParticipantLanguageMap = {}
        for (let i = 0; i < partyCount; i += 1) next[i] = code
        return next
      })
      openColumn(code)
    },
    [partyCount, openColumn],
  )

  const handleCloseLanguage = useCallback((code: string) => {
    setOpenedLanguages((prev) => prev.filter((c) => c !== code))
  }, [])

  const gateId = 'language-step-gate'
  // landr-80ubl.1: one next action per screen — the board while anyone is
  // unplaced, Continue (via ContinueAction) once everyone is.
  const nextActionCue = complete ? null : languageStepCue(unassignedLabels, started, locale)

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('guideLanguageTitle', locale)}</CardTitle>
        <CardDescription>{productName}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* landr-80ubl.1: zen by default — the why and the how-to sit behind
            the disclosure; the NextAction cue is the one-line instruction.
            "Assign with dropdowns instead" stays where it was (inside the
            board, already collapsed): it is the a11y fallback, not help copy. */}
        <HelpDisclosure data-testid="language-step-help">
          <p>{tr('languageStepWhy', locale)}</p>
          <p>{tr('languageStepHowTo', locale)}</p>
        </HelpDisclosure>

        <ParticipantLanguageBoard
          offeredLanguages={offeredLanguages}
          openLanguages={openLanguages}
          participantNames={participantNames}
          guestFlags={guestFlags}
          assignment={assignment}
          onAssign={handleAssign}
          onAssignEveryone={handleAssignEveryone}
          onOpenLanguage={openColumn}
          onCloseLanguage={handleCloseLanguage}
          nextActionCue={nextActionCue}
        />

        {otherLanguages ? (
          <OptionalReveal
            thing={otherLanguages.label}
            hasValue={otherLanguages.value !== ''}
            data-testid="language-step-other-languages-reveal"
          >
            <div className="flex flex-col gap-1" data-testid="language-step-other-languages">
              <Label htmlFor="language-step-other-languages-input" className="text-xs">
                {otherLanguages.label} {tr('optionalSuffix', locale)}
              </Label>
              <Input
                id="language-step-other-languages-input"
                data-testid="language-step-other-languages-input"
                value={otherLanguages.value}
                maxLength={otherLanguages.maxLength ?? undefined}
                onChange={(e) => otherLanguages.onChange(e.target.value)}
              />
              {otherLanguages.helpText ? (
                <p className="text-xs text-muted-foreground">{otherLanguages.helpText}</p>
              ) : null}
            </div>
          </OptionalReveal>
        ) : null}

        {/* landr-n6ii3: same field DetailsStep collects, editable here too —
            last field before Continue. */}
        <CustomerCommentField
          value={customerComment}
          onChange={onCustomerCommentChange}
          collapsible
        />

        {/* The gate is a role="status" live region the disabled Continue
            points at (aria-describedby) — a disabled button with a silent
            explanation is invisible to a screen reader. Before the customer
            has placed anyone it is guidance, not a failure, so it only turns
            red once they have started. */}
        <ContinueAction
          ready={complete}
          reason={languageStepGate(unassignedLabels, locale)}
          reasonId={gateId}
          reasonTestId="language-step-gate"
          reasonClassName={!complete && started ? 'text-destructive' : undefined}
          onContinue={() => onConfirm(assignment)}
          data-testid="language-step-submit"
        />
      </CardContent>
    </Card>
  )
}
