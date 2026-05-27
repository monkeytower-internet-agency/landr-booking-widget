// landr-ifcu: v1 is English-only. The pickBundle / tr API is preserved so
// existing call sites compile unchanged, but locale arguments are ignored —
// every caller gets the English bundle regardless of browser locale.

type Bundle = {
  multiDayPickerHelp: string
}

const en: Bundle = {
  // landr-4xyd: Shift/Cmd/Ctrl wording removed; mode toggle in the picker
  // now drives help text. This string is kept for callers that pass it as
  // a helpText override; MultiDayStep no longer passes it (passes undefined).
  multiDayPickerHelp: 'Tap days to add or remove them.',
}

export function pickBundle(locale?: string): Bundle {
  void locale
  return en
}

export function tr(key: keyof Bundle, locale?: string): string {
  void locale
  return en[key]
}
