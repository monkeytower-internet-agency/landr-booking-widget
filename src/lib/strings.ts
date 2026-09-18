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
