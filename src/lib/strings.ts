// landr-ifcu: v1 is English-only. The pickBundle / tr API is preserved so
// existing call sites compile unchanged, but locale arguments are ignored —
// every caller gets the English bundle regardless of browser locale.

type Bundle = {
  multiDayPickerHelp: string
  /**
   * landr-de6ej: hint under DetailsStep's optional "Anything we should
   * know?" comment field. Sets the expectation that a NON-EMPTY comment
   * routes the booking to human review (the API's approval evaluator
   * forces requires_general_approval whenever this field is filled in)
   * before the customer types anything, rather than surprising them later.
   */
  customerCommentHint: string
  /**
   * landr-80ubl.1: zen-by-default primitives. `nextActionPrefix` leads the
   * accent cue NextAction shows over the one pending required control;
   * `helpDisclosureLabel` is HelpDisclosure's toggle ("ⓘ" is decoration,
   * added by the component, aria-hidden).
   */
  nextActionPrefix: string
  helpDisclosureLabel: string
  /** landr-80ubl.1: the Continue CTA's own cue once the step is satisfied. */
  continueCue: string
  continueLabel: string
  /** landr-80ubl.1: OptionalReveal's link text for CustomerCommentField. */
  customerCommentAdd: string
  /** landr-80ubl.1: LanguageStep's explanation copy (behind HelpDisclosure). */
  languageStepWhy: string
  languageStepHowTo: string
  /**
   * landr-80ubl.2: rollout A (catalog/product/date steps) NextAction cues
   * and HelpDisclosure copy. Picker steps with no real "how it works" to
   * explain (a tile grid, a calendar) get no HelpDisclosure — only the ones
   * with an actual gesture to teach (MultiDayPicker's tap/range modes).
   */
  categoryStepCue: string
  productListCue: string
  productDetailCue: string
  singleDatePickerCue: string
  multiDayPickerCue: string
  fixedDateWindowCue: string
  availabilityDateCue: string
  availabilityTimeCue: string
}

const en: Bundle = {
  // landr-4xyd: Shift/Cmd/Ctrl wording removed; mode toggle in the picker
  // now drives help text. This string is kept for callers that pass it as
  // a helpText override; MultiDayStep no longer passes it (passes undefined).
  multiDayPickerHelp: 'Tap days to add or remove them.',
  customerCommentHint:
    'If you add a comment, a person will read your request before it is ' +
    'confirmed, so it can take a little longer. If it matters, please do ' +
    'tell us.',
  nextActionPrefix: 'Next:',
  helpDisclosureLabel: 'How this works',
  continueCue: 'continue',
  continueLabel: 'Continue',
  customerCommentAdd: 'a note for us',
  languageStepWhy:
    'Tell us who speaks what, so the guide briefs everyone in a language ' +
    'they understand.',
  languageStepHowTo:
    'Tap a language to put everyone in it. To split the group, drag a name ' +
    'onto another language — or tap a name and then tap a language.',
  categoryStepCue: 'choose a category',
  productListCue: 'choose a product',
  productDetailCue: 'book this trip',
  // landr-80ubl.2: deliberately NOT "pick a date" / "pick your dates" — the
  // NextAction cue's text ("Next: <cue>") sits right beside the step's own
  // CardTitle ("Pick a date" / "Pick your dates"), and App.test.tsx's
  // step-arrival assertions do screen.getByText(/Pick a date/i) etc., which
  // matches ANY element whose text contains that phrase. A cue that repeats
  // the heading makes getByText ambiguous (two matches) and times out the
  // whole flow-advancing helper. Distinct verbs sidestep it.
  singleDatePickerCue: 'choose a date',
  multiDayPickerCue: 'choose your dates',
  fixedDateWindowCue: 'choose a window',
  availabilityDateCue: 'choose a date',
  availabilityTimeCue: 'choose a time',
}

export function pickBundle(locale?: string): Bundle {
  void locale
  return en
}

export function tr(key: keyof Bundle, locale?: string): string {
  void locale
  return en[key]
}

/**
 * landr-80ubl.1: OptionalReveal's collapsed link text, "Add <thing>" (the
 * "+" is decoration the component adds). `thing` is lower-cased at its first
 * letter only when it reads like a sentence-case label ("Other languages
 * spoken" → "other languages spoken"), so an acronym or a name keeps its case.
 */
export function optionalRevealLabel(thing: string, locale?: string): string {
  void locale
  const t = /^[A-Z][a-z]/.test(thing) ? thing.charAt(0).toLowerCase() + thing.slice(1) : thing
  return `Add ${t}`
}

/**
 * landr-80ubl.1: LanguageStep's NextAction cue. Nobody placed yet and a group
 * → one tap does it for everyone, so say so; otherwise name who is left.
 */
export function languageStepCue(
  unassignedNames: string[],
  anyoneAssigned: boolean,
  locale?: string,
): string {
  void locale
  if (!anyoneAssigned && unassignedNames.length > 1) {
    return 'tap the language your group speaks'
  }
  const [first, second] = unassignedNames
  const who =
    unassignedNames.length === 1
      ? first
      : unassignedNames.length === 2
        ? `${first} and ${second}`
        : `${first} and ${unassignedNames.length - 1} others`
  return `pick a language for ${who}`
}

/** landr-80ubl.1: LanguageStep's gate line beside Continue. */
export function languageStepGate(unassignedNames: string[], locale?: string): string {
  void locale
  return unassignedNames.length === 0
    ? 'Everyone has a language.'
    : `Assign every participant to a language — still waiting on ${unassignedNames.join(', ')}.`
}

/**
 * landr-80ubl.2: SingleDatePicker / AvailabilityPicker / FixedDateWindowPicker's
 * gate line beside Continue. Deliberately "Choose…", not "Pick…" — the
 * CardTitle above already reads "Pick a date" and App.test.tsx's
 * screen.getByText(/Pick a date/i) helpers match ANY element containing that
 * phrase, so a gate line repeating it makes the query ambiguous (see the cue
 * strings' comment above for the same trap).
 */
export function singleDateGate(hasSelection: boolean, locale?: string): string {
  void locale
  return hasSelection ? 'Date selected.' : 'Choose a date to continue.'
}

/** landr-80ubl.2: MultiDayStep's gate line beside Continue. */
export function multiDayGate(selectedCount: number, locale?: string): string {
  void locale
  if (selectedCount === 0) return 'Choose at least one date to continue.'
  return selectedCount === 1 ? '1 date selected.' : `${selectedCount} dates selected.`
}

/** landr-80ubl.2: FixedDateWindowPicker's gate line beside Continue. */
export function fixedDateWindowGate(hasSelection: boolean, locale?: string): string {
  void locale
  return hasSelection ? 'Window selected.' : 'Choose a window to continue.'
}

/** landr-80ubl.2: AvailabilityPicker's gate line beside Continue. */
export function availabilityGate(
  hasDate: boolean,
  hasTime: boolean,
  locale?: string,
): string {
  void locale
  if (hasTime) return 'Time selected.'
  if (hasDate) return 'Choose a time to continue.'
  return 'Choose a date to continue.'
}

/**
 * landr-t869m.2: the "activity still bookable, hotel too late" copy —
 * shown in AccommodationStep when a day is activity_bookable but the
 * derived stay's own lead time (products.accommodation_lead_time_minutes)
 * has run out (hotel_offering='optional' only; 'mandatory' never reaches
 * this because the day itself is excluded from the picker). Takes an
 * already-formatted date label (see formatDayLabel in dateLabel.ts) rather
 * than a raw ISO string so this stays a plain template, matching every
 * other date-bearing string surface in the widget.
 *
 * Parameterised strings can't live on the flat Bundle type above (v1 is
 * English-only — see file header — so this skips pickBundle/tr and returns
 * the English template directly; the locale parameter is kept, unused, for
 * parity with the rest of this module so a future locale add touches one
 * file).
 */
export function accommodationTooLateMessage(
  checkinDateLabel: string,
  locale?: string,
): string {
  void locale
  return (
    `You can still book this date — the activity is available. ` +
    `Booking a hotel stay is no longer possible for this date, though: ` +
    `check-in would have needed to be on ${checkinDateLabel}.`
  )
}

/**
 * landr-t869m.5: which gate(s) a staff force-book bypassed. Lives here
 * (rather than in bookability.ts, which components import) because it's
 * purely about copy — `forceReasonsFor` in bookability.ts is what computes
 * which of these apply to a given slot/window.
 */
export type ForceReason = 'capacity' | 'lead_time' | 'accommodation_lead_time'

const FORCE_REASON_CLAUSE: Record<ForceReason, string> = {
  capacity: 'past capacity',
  lead_time: 'inside the lead-time window',
  accommodation_lead_time: "with the hotel stay past the hotel's own lead time",
}

const FORCE_REASON_CONSEQUENCE: Record<ForceReason, string> = {
  capacity: 'Capacity will be exceeded',
  lead_time: 'the customer will not have the normal preparation time',
  accommodation_lead_time: "the hotel will not have its normal preparation time",
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * landr-t869m.5: the clause fragment naming which gate(s) were bypassed —
 * e.g. "past capacity", "inside the lead-time window", or "past capacity
 * and inside the lead-time window" when more than one applied. Used both by
 * BookingForm's review-forced banner (via forceBookReasonMessage below) and
 * by MultiDayPicker's own inline forced-days badge, so the two surfaces
 * never drift into contradicting each other about why a day was forced.
 */
export function describeForceReasons(reasons: ForceReason[]): string {
  const effective = reasons.length > 0 ? reasons : (['capacity'] as ForceReason[])
  return joinWithAnd(effective.map((r) => FORCE_REASON_CLAUSE[r]))
}

/**
 * landr-t869m.5: names the actual gate(s) a staff force-book bypassed, on
 * BookingForm's review-forced banner. This used to be one hard-coded
 * capacity-flavoured sentence regardless of why the pick was actually
 * forced — wrong (and misleading to the operator) the moment a lead-time
 * override folded into the same `forced`/`forcedDays` flag (landr-t869m.2's
 * pickers reuse isDayBookable's combined gate for exactly that reason).
 *
 * Capacity-only (or an empty/omitted `reasons` — the FAIL-OPEN default for
 * any caller that predates this ticket) renders the EXACT pre-existing
 * copy, character for character. A lead-time reason gets its own wording
 * instead of the (false) "capacity will be exceeded" claim; a pick that hit
 * more than one gate at once names every reason that applies.
 */
export function forceBookReasonMessage(
  reasons: ForceReason[],
  forcedDaysCount: number,
  locale?: string,
): string {
  void locale
  const effective = reasons.length > 0 ? reasons : (['capacity'] as ForceReason[])
  const subject =
    forcedDaysCount > 0
      ? `${forcedDaysCount} day${forcedDaysCount === 1 ? '' : 's'} booked`
      : 'This window was booked'
  const clause = describeForceReasons(effective)
  const consequence = joinWithAnd(effective.map((r) => FORCE_REASON_CONSEQUENCE[r]))
  const capitalizedConsequence =
    consequence.charAt(0).toUpperCase() + consequence.slice(1)
  return `${subject} ${clause}. ${capitalizedConsequence} for this booking.`
}
