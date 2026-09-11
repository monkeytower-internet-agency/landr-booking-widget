/**
 * landr-r6e5x.4 — LanguageStep
 *
 * Epic decision D3, as its OWN funnel step: assign every party member
 * (participants and companions alike) to exactly one of the operator's offered
 * guide languages before the booking can be submitted.
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
 * every product, gated only on the operator offering any language at all —
 * which `operators.offered_languages` (NOT NULL, four-language default) makes
 * universal.
 *
 * It sits BEFORE the custom-form chain so that a flow which also declares a
 * `language` field mirrors this answer rather than asking twice.
 *
 * The board itself (drag / tap / dropdown) lives in ParticipantLanguageBoard;
 * this file is the step frame: the card, the submit gate, and the seeding
 * rules that keep the common cases down to one gesture.
 */
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
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
  onBack,
  onConfirm,
}: LanguageStepProps) {
  const partyCount = participantNames.length

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

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Guide language</CardTitle>
        <CardDescription>
          {productName} · who speaks what, so the guide briefs everyone in a
          language they understand
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
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
        />

        {/* role="status" so the gate is announced when it changes — a disabled
            Continue with a silent explanation is invisible to a screen reader.
            The button points at it via aria-describedby, so focusing Continue
            reads out why it cannot be pressed. */}
        <p
          id={gateId}
          role="status"
          className={
            complete
              ? 'text-xs text-muted-foreground'
              : started
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
          }
          data-testid="language-step-gate"
        >
          {complete
            ? 'Everyone has a language.'
            : `Assign every participant to a language — still waiting on ${unassignedLabels.join(', ')}.`}
        </p>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => onConfirm(assignment)}
            disabled={!complete}
            aria-describedby={complete ? undefined : gateId}
            data-testid="language-step-submit"
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
