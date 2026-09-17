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
