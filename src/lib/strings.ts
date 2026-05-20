// landr-ifcu: v1 is English-only. The pickBundle / tr API is preserved so
// existing call sites compile unchanged, but locale arguments are ignored —
// every caller gets the English bundle regardless of browser locale.

type Bundle = {
  multiDayPickerHelp: string
}

const en: Bundle = {
  multiDayPickerHelp:
    'Click to pick a date. Click another to make a range. Hold Shift (or Cmd/Ctrl) to toggle individual days.',
}

export function pickBundle(locale?: string): Bundle {
  void locale
  return en
}

export function tr(key: keyof Bundle, locale?: string): string {
  void locale
  return en[key]
}
