/**
 * Page-scoped de/en/es string bundle for ApprovalReplyPage (landr-em0r.9).
 *
 * Deliberately NOT src/lib/strings.ts — per epic decision (g) and bd
 * decision landr-ifcu, that module's `pickBundle`/`tr` helpers ignore
 * their locale argument entirely (the rest of the widget is English-only
 * by design). This page is different: the `hotel_request` email is sent
 * in de/en/es following the HOTEL's language (operators.hotel_email_locale
 * → customer/operator fallback), not the customer's, so the button in that
 * email must land on a page in the same language or a Spanish hotel gets
 * an English page from a Spanish email.
 *
 * Locale resolution (ApprovalReplyPage owns this, not this module):
 *   1. `?lang=de|en|es` query override (persists across the session via the
 *      footer language switcher, which just re-applies this same override).
 *   2. the GET response's `locale` field (what the email was actually sent in).
 *   3. 'en' fallback.
 */

export type ReplyLocale = 'de' | 'en' | 'es'

export const REPLY_LOCALES: ReplyLocale[] = ['de', 'en', 'es']

export interface ApprovalReplyBundle {
  loadingTitle: string
  errorTitle: string
  errorBody: string
  tryAgain: string

  pageTitle: string
  requestRefLabel: string
  checkInLabel: string
  checkOutLabel: string
  nightsLabel: string
  guestsLabel: string
  roomsLabel: string
  hotelLabel: string

  optionConfirmedTitle: string
  optionDeclinedTitle: string
  optionChangesTitle: string

  commentLabel: string
  commentPlaceholderChanges: string
  commentPlaceholderDefault: string
  commentRequiredHint: string
  reasonChipFullyBooked: string
  reasonChipDatesNotPossible: string
  reasonChipGroupTooLarge: string
  reasonChipOther: string

  nameLabel: string
  namePlaceholder: string

  confirmButton: string
  confirmButtonBusy: string
  changeAnswerButton: string

  answeredTitle: string
  answeredBody: string

  expiredTitle: string
  expiredBody: string
  supersededTitle: string
  supersededBody: string
  closedConfirmedTitle: string
  closedConfirmedBody: string
  closedCancelledTitle: string
  closedCancelledBody: string

  successTitle: string
  successBody: string
  successAlreadyRecorded: string

  languageSwitcherLabel: string
}

const en: ApprovalReplyBundle = {
  loadingTitle: 'Loading…',
  errorTitle: 'Something went wrong',
  errorBody:
    'We could not load this reply. The link may be invalid, or there was a temporary problem. Please try again, or reply to the original email.',
  tryAgain: 'Try again',

  pageTitle: 'Rooms request',
  requestRefLabel: 'Reference',
  checkInLabel: 'Check-in',
  checkOutLabel: 'Check-out',
  nightsLabel: 'Nights',
  guestsLabel: 'Guests',
  roomsLabel: 'Rooms',
  hotelLabel: 'Hotel',

  optionConfirmedTitle: 'Yes, rooms confirmed',
  optionDeclinedTitle: "No, we can't take this booking",
  optionChangesTitle: 'Yes, but with changes',

  commentLabel: 'Comment',
  commentPlaceholderChanges: 'Tell us what needs to change (required)…',
  commentPlaceholderDefault: 'Add a comment (optional)…',
  commentRequiredHint: 'Please describe the changes — this field is required.',
  reasonChipFullyBooked: 'Fully booked',
  reasonChipDatesNotPossible: 'Dates not possible',
  reasonChipGroupTooLarge: 'Group too large',
  reasonChipOther: 'Other',

  nameLabel: 'Your name (optional)',
  namePlaceholder: 'Who is answering?',

  confirmButton: 'Confirm',
  confirmButtonBusy: 'Confirming…',
  changeAnswerButton: 'Change my answer',

  answeredTitle: 'Your answer has been recorded',
  answeredBody: 'You told {operator} {decision} on {date}.',

  expiredTitle: 'This link has expired',
  expiredBody: 'Please reply to the email or call {phone}.',
  supersededTitle: 'This link is no longer current',
  supersededBody:
    '{operator} sent an updated request — please use their most recent email, or call {phone}.',
  closedConfirmedTitle: 'Already confirmed',
  closedConfirmedBody:
    'Thanks — this booking is already confirmed with {operator}. Nothing further needed.',
  closedCancelledTitle: 'Booking cancelled',
  closedCancelledBody: 'This booking was cancelled — no rooms needed.',

  successTitle: 'Thank you',
  successBody: "We've recorded your answer and let {operator} know.",
  successAlreadyRecorded: 'We already had this answer on file — nothing changed.',

  languageSwitcherLabel: 'Language',
}

const de: ApprovalReplyBundle = {
  loadingTitle: 'Wird geladen…',
  errorTitle: 'Etwas ist schiefgelaufen',
  errorBody:
    'Wir konnten diese Anfrage nicht laden. Der Link könnte ungültig sein, oder es gab ein vorübergehendes Problem. Bitte versuchen Sie es erneut oder antworten Sie auf die ursprüngliche E-Mail.',
  tryAgain: 'Erneut versuchen',

  pageTitle: 'Zimmeranfrage',
  requestRefLabel: 'Referenz',
  checkInLabel: 'Anreise',
  checkOutLabel: 'Abreise',
  nightsLabel: 'Nächte',
  guestsLabel: 'Gäste',
  roomsLabel: 'Zimmer',
  hotelLabel: 'Hotel',

  optionConfirmedTitle: 'Ja, Zimmer bestätigt',
  optionDeclinedTitle: 'Nein, wir können diese Buchung nicht annehmen',
  optionChangesTitle: 'Ja, aber mit Änderungen',

  commentLabel: 'Kommentar',
  commentPlaceholderChanges:
    'Bitte beschreiben Sie, was geändert werden muss (erforderlich)…',
  commentPlaceholderDefault: 'Kommentar hinzufügen (optional)…',
  commentRequiredHint:
    'Bitte beschreiben Sie die Änderungen — dieses Feld ist erforderlich.',
  reasonChipFullyBooked: 'Ausgebucht',
  reasonChipDatesNotPossible: 'Termine nicht möglich',
  reasonChipGroupTooLarge: 'Gruppe zu groß',
  reasonChipOther: 'Sonstiges',

  nameLabel: 'Ihr Name (optional)',
  namePlaceholder: 'Wer antwortet?',

  confirmButton: 'Bestätigen',
  confirmButtonBusy: 'Wird bestätigt…',
  changeAnswerButton: 'Antwort ändern',

  answeredTitle: 'Ihre Antwort wurde gespeichert',
  answeredBody: 'Sie haben {operator} am {date} mit „{decision}“ geantwortet.',

  expiredTitle: 'Dieser Link ist abgelaufen',
  expiredBody: 'Bitte antworten Sie auf die E-Mail oder rufen Sie {phone} an.',
  supersededTitle: 'Dieser Link ist nicht mehr aktuell',
  supersededBody:
    '{operator} hat eine aktualisierte Anfrage gesendet — bitte verwenden Sie die neueste E-Mail oder rufen Sie {phone} an.',
  closedConfirmedTitle: 'Bereits bestätigt',
  closedConfirmedBody:
    'Danke — diese Buchung ist bei {operator} bereits bestätigt. Es ist nichts weiter nötig.',
  closedCancelledTitle: 'Buchung storniert',
  closedCancelledBody: 'Diese Buchung wurde storniert — keine Zimmer benötigt.',

  successTitle: 'Vielen Dank',
  successBody: 'Wir haben Ihre Antwort gespeichert und {operator} informiert.',
  successAlreadyRecorded:
    'Diese Antwort war bereits bei uns hinterlegt — es hat sich nichts geändert.',

  languageSwitcherLabel: 'Sprache',
}

const es: ApprovalReplyBundle = {
  loadingTitle: 'Cargando…',
  errorTitle: 'Algo salió mal',
  errorBody:
    'No pudimos cargar esta solicitud. El enlace podría no ser válido, o hubo un problema temporal. Inténtelo de nuevo o responda al correo original.',
  tryAgain: 'Intentar de nuevo',

  pageTitle: 'Solicitud de habitaciones',
  requestRefLabel: 'Referencia',
  checkInLabel: 'Entrada',
  checkOutLabel: 'Salida',
  nightsLabel: 'Noches',
  guestsLabel: 'Huéspedes',
  roomsLabel: 'Habitaciones',
  hotelLabel: 'Hotel',

  optionConfirmedTitle: 'Sí, habitaciones confirmadas',
  optionDeclinedTitle: 'No, no podemos aceptar esta reserva',
  optionChangesTitle: 'Sí, pero con cambios',

  commentLabel: 'Comentario',
  commentPlaceholderChanges: 'Indique qué debe cambiar (obligatorio)…',
  commentPlaceholderDefault: 'Añadir un comentario (opcional)…',
  commentRequiredHint:
    'Por favor describa los cambios — este campo es obligatorio.',
  reasonChipFullyBooked: 'Completo',
  reasonChipDatesNotPossible: 'Fechas no posibles',
  reasonChipGroupTooLarge: 'Grupo demasiado grande',
  reasonChipOther: 'Otro',

  nameLabel: 'Su nombre (opcional)',
  namePlaceholder: '¿Quién responde?',

  confirmButton: 'Confirmar',
  confirmButtonBusy: 'Confirmando…',
  changeAnswerButton: 'Cambiar mi respuesta',

  answeredTitle: 'Su respuesta ha sido registrada',
  answeredBody: 'Le dijo a {operator} "{decision}" el {date}.',

  expiredTitle: 'Este enlace ha caducado',
  expiredBody: 'Responda al correo o llame al {phone}.',
  supersededTitle: 'Este enlace ya no es válido',
  supersededBody:
    '{operator} envió una solicitud actualizada — use su correo más reciente, o llame al {phone}.',
  closedConfirmedTitle: 'Ya confirmado',
  closedConfirmedBody:
    'Gracias — esta reserva ya está confirmada con {operator}. No se necesita nada más.',
  closedCancelledTitle: 'Reserva cancelada',
  closedCancelledBody: 'Esta reserva fue cancelada — no se necesitan habitaciones.',

  successTitle: 'Gracias',
  successBody: 'Hemos registrado su respuesta y avisado a {operator}.',
  successAlreadyRecorded:
    'Ya teníamos esta respuesta registrada — no ha cambiado nada.',

  languageSwitcherLabel: 'Idioma',
}

const BUNDLES: Record<ReplyLocale, ApprovalReplyBundle> = { en, de, es }

/** Normalise an arbitrary locale string ('de-AT', 'ES', …) to a supported bundle key. */
export function normalizeReplyLocale(locale: string | null | undefined): ReplyLocale {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  if (base === 'de' || base === 'en' || base === 'es') return base
  return 'en'
}

export function pickReplyBundle(locale: string | null | undefined): ApprovalReplyBundle {
  return BUNDLES[normalizeReplyLocale(locale)]
}

/** Substitute `{key}` placeholders in a bundle string. Unknown keys are left as-is. */
export function fmt(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  )
}
