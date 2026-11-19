/**
 * Page-scoped de/en/es/tr string bundle for ApprovalReplyPage (landr-em0r.9).
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
 *   1. `?lang=de|en|es|tr` query override (persists across the session via the
 *      footer language switcher, which just re-applies this same override).
 *   2. the GET response's `locale` field (what the email was actually sent in).
 *   3. 'en' fallback.
 */

export type ReplyLocale = 'de' | 'en' | 'es' | 'it' | 'tr'

export const REPLY_LOCALES: ReplyLocale[] = ['de', 'en', 'es', 'it', 'tr']

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
    "We couldn't load this request. The link may be invalid, or something went wrong on our side. Try again or reply to the original email.",
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
  commentRequiredHint: 'Describe the changes. This field is required.',
  reasonChipFullyBooked: 'Fully booked',
  reasonChipDatesNotPossible: 'Dates not available',
  reasonChipGroupTooLarge: 'Group too large',
  reasonChipOther: 'Other',

  nameLabel: 'Your name (optional)',
  namePlaceholder: 'Who is answering?',

  confirmButton: 'Confirm',
  confirmButtonBusy: 'Confirming…',
  changeAnswerButton: 'Change my answer',

  answeredTitle: 'Your answer has been recorded',
  answeredBody: 'On {date}, you answered {operator}: “{decision}”.',

  expiredTitle: 'This link has expired',
  expiredBody: 'Reply to the email or call {phone}.',
  supersededTitle: 'This link is no longer current',
  supersededBody:
    '{operator} has sent an updated request. Use their latest email or call {phone}.',
  closedConfirmedTitle: 'Already confirmed',
  closedConfirmedBody:
    "Thanks, this booking is already confirmed with {operator}. You don't need to do anything else.",
  closedCancelledTitle: 'Booking cancelled',
  closedCancelledBody: 'This booking was cancelled, so no rooms are needed.',

  successTitle: 'Thank you',
  successBody: "We've recorded your answer and let {operator} know.",
  successAlreadyRecorded: 'We already had this answer, so nothing has changed.',

  languageSwitcherLabel: 'Language',
}

const de: ApprovalReplyBundle = {
  loadingTitle: 'Wird geladen…',
  errorTitle: 'Etwas ist schiefgelaufen',
  errorBody:
    'Diese Anfrage ließ sich nicht laden. Vielleicht ist der Link ungültig oder es gab eine kurze Störung. Versuchen Sie es erneut oder antworten Sie auf die ursprüngliche E-Mail.',
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
    'Beschreiben Sie die gewünschten Änderungen (Pflichtfeld)…',
  commentPlaceholderDefault: 'Kommentar hinzufügen (optional)…',
  commentRequiredHint:
    'Bitte beschreiben Sie die Änderungen. Dies ist ein Pflichtfeld.',
  reasonChipFullyBooked: 'Ausgebucht',
  reasonChipDatesNotPossible: 'Zeitraum nicht verfügbar',
  reasonChipGroupTooLarge: 'Gruppe zu groß',
  reasonChipOther: 'Sonstiges',

  nameLabel: 'Ihr Name (optional)',
  namePlaceholder: 'Wer antwortet?',

  confirmButton: 'Bestätigen',
  confirmButtonBusy: 'Wird bestätigt…',
  changeAnswerButton: 'Antwort ändern',

  answeredTitle: 'Ihre Antwort wurde gespeichert',
  answeredBody: 'Sie haben {operator} am {date} geantwortet: „{decision}“.',

  expiredTitle: 'Dieser Link ist abgelaufen',
  expiredBody: 'Bitte antworten Sie auf die E-Mail oder rufen Sie {phone} an.',
  supersededTitle: 'Dieser Link ist nicht mehr aktuell',
  supersededBody:
    '{operator} hat eine neue Anfrage geschickt. Bitte nutzen Sie die neueste E-Mail oder rufen Sie {phone} an.',
  closedConfirmedTitle: 'Bereits bestätigt',
  closedConfirmedBody:
    'Danke, diese Buchung ist bei {operator} bereits bestätigt. Sie müssen nichts weiter tun.',
  closedCancelledTitle: 'Buchung storniert',
  closedCancelledBody: 'Diese Buchung wurde storniert. Es werden keine Zimmer benötigt.',

  successTitle: 'Vielen Dank',
  successBody: 'Wir haben Ihre Antwort gespeichert und {operator} informiert.',
  successAlreadyRecorded:
    'Diese Antwort lag uns bereits vor. Es hat sich nichts geändert.',

  languageSwitcherLabel: 'Sprache',
}

const it: ApprovalReplyBundle = {
  loadingTitle: 'Caricamento…',
  errorTitle: 'Qualcosa è andato storto',
  errorBody:
    'Non siamo riusciti a caricare la richiesta. Il link potrebbe non essere valido o potrebbe esserci un problema temporaneo. Riprovi o risponda all\u2019e-mail originale.',
  tryAgain: 'Riprova',

  pageTitle: 'Richiesta di camere',
  requestRefLabel: 'Riferimento',
  checkInLabel: 'Check-in',
  checkOutLabel: 'Check-out',
  nightsLabel: 'Notti',
  guestsLabel: 'Ospiti',
  roomsLabel: 'Camere',
  hotelLabel: 'Hotel',

  optionConfirmedTitle: 'Sì, camere confermate',
  optionDeclinedTitle: 'No, non possiamo accettare questa prenotazione',
  optionChangesTitle: 'Sì, ma con modifiche',

  commentLabel: 'Commento',
  commentPlaceholderChanges: 'Indichi cosa va modificato (obbligatorio)…',
  commentPlaceholderDefault: 'Aggiunga un commento (facoltativo)…',
  commentRequiredHint:
    'Descriva le modifiche: questo campo è obbligatorio.',
  reasonChipFullyBooked: 'Al completo',
  reasonChipDatesNotPossible: 'Date non disponibili',
  reasonChipGroupTooLarge: 'Gruppo troppo grande',
  reasonChipOther: 'Altro',

  nameLabel: 'Il suo nome (facoltativo)',
  namePlaceholder: 'Chi risponde?',

  confirmButton: 'Conferma',
  confirmButtonBusy: 'Conferma in corso…',
  changeAnswerButton: 'Modifica la risposta',

  answeredTitle: 'La sua risposta è stata registrata',
  answeredBody: 'Il {date} ha risposto a {operator}: “{decision}”.',

  expiredTitle: 'Questo link è scaduto',
  expiredBody: 'Risponda all\u2019e-mail o chiami il {phone}.',
  supersededTitle: 'Questo link non è più valido',
  supersededBody:
    '{operator} ha inviato una richiesta aggiornata: usi l\u2019e-mail più recente oppure chiami il {phone}.',
  closedConfirmedTitle: 'Già confermata',
  closedConfirmedBody:
    'Grazie, questa prenotazione è già confermata con {operator}. Non deve fare altro.',
  closedCancelledTitle: 'Prenotazione cancellata',
  closedCancelledBody: 'Questa prenotazione è stata cancellata: non servono camere.',

  successTitle: 'Grazie',
  successBody: 'Abbiamo registrato la sua risposta e avvisato {operator}.',
  successAlreadyRecorded:
    'Avevamo già registrato questa risposta: non è cambiato nulla.',

  languageSwitcherLabel: 'Lingua',
}

const es: ApprovalReplyBundle = {
  loadingTitle: 'Cargando…',
  errorTitle: 'Algo salió mal',
  errorBody:
    'No hemos podido cargar esta solicitud. Puede que el enlace no sea válido o que haya habido un problema temporal. Inténtelo de nuevo o responda al correo original.',
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
    'Describa los cambios. Este campo es obligatorio.',
  reasonChipFullyBooked: 'Completo',
  reasonChipDatesNotPossible: 'Fechas no disponibles',
  reasonChipGroupTooLarge: 'Grupo demasiado grande',
  reasonChipOther: 'Otro',

  nameLabel: 'Su nombre (opcional)',
  namePlaceholder: '¿Quién responde?',

  confirmButton: 'Confirmar',
  confirmButtonBusy: 'Confirmando…',
  changeAnswerButton: 'Cambiar mi respuesta',

  answeredTitle: 'Hemos registrado su respuesta',
  answeredBody: 'El {date} respondió a {operator}: “{decision}”.',

  expiredTitle: 'Este enlace ha caducado',
  expiredBody: 'Responda al correo o llame al {phone}.',
  supersededTitle: 'Este enlace ya no es válido',
  supersededBody:
    '{operator} ha enviado una solicitud actualizada. Use el correo más reciente o llame al {phone}.',
  closedConfirmedTitle: 'Ya confirmada',
  closedConfirmedBody:
    'Gracias, esta reserva ya está confirmada con {operator}. No tiene que hacer nada más.',
  closedCancelledTitle: 'Reserva cancelada',
  closedCancelledBody: 'Esta reserva se ha cancelado, así que no se necesitan habitaciones.',

  successTitle: 'Gracias',
  successBody: 'Hemos registrado su respuesta y avisado a {operator}.',
  successAlreadyRecorded:
    'Ya teníamos registrada esta respuesta. No ha cambiado nada.',

  languageSwitcherLabel: 'Idioma',
}

const tr: ApprovalReplyBundle = {
  loadingTitle: 'Yükleniyor…',
  errorTitle: 'Bir şeyler ters gitti',
  errorBody:
    'Bu sayfa yüklenemedi. Bağlantı geçersiz olabilir ya da geçici bir sorun yaşanıyor olabilir. Tekrar deneyin veya ilk e-postayı yanıtlayın.',
  tryAgain: 'Tekrar dene',

  pageTitle: 'Oda talebi',
  requestRefLabel: 'Referans',
  checkInLabel: 'Giriş',
  checkOutLabel: 'Çıkış',
  nightsLabel: 'Gece',
  guestsLabel: 'Misafir',
  roomsLabel: 'Oda',
  hotelLabel: 'Otel',

  optionConfirmedTitle: 'Evet, odalar onaylandı',
  optionDeclinedTitle: 'Hayır, bu rezervasyonu alamıyoruz',
  optionChangesTitle: 'Evet, ama bazı değişikliklerle',

  commentLabel: 'Yorum',
  commentPlaceholderChanges: 'Nelerin değişmesi gerektiğini yazın (zorunlu)…',
  commentPlaceholderDefault: 'Yorum ekleyin (isteğe bağlı)…',
  commentRequiredHint: 'Lütfen değişiklikleri açıklayın. Bu alan zorunludur.',
  reasonChipFullyBooked: 'Tamamen dolu',
  reasonChipDatesNotPossible: 'Tarihler uygun değil',
  reasonChipGroupTooLarge: 'Grup çok büyük',
  reasonChipOther: 'Diğer',

  nameLabel: 'Adınız (isteğe bağlı)',
  namePlaceholder: 'Kim yanıtlıyor?',

  confirmButton: 'Onayla',
  confirmButtonBusy: 'Onaylanıyor…',
  changeAnswerButton: 'Yanıtımı değiştir',

  answeredTitle: 'Yanıtınız kaydedildi',
  answeredBody: '{date} tarihinde {operator} firmasına “{decision}” yanıtını verdiniz.',

  expiredTitle: 'Bu bağlantının süresi doldu',
  expiredBody: 'Lütfen e-postayı yanıtlayın veya {phone} numarasını arayın.',
  supersededTitle: 'Bu bağlantı artık güncel değil',
  supersededBody:
    '{operator} güncel bir talep gönderdi. Lütfen en son e-postayı kullanın veya {phone} numarasını arayın.',
  closedConfirmedTitle: 'Zaten onaylandı',
  closedConfirmedBody:
    'Teşekkürler, bu rezervasyon {operator} ile zaten onaylandı. Başka bir şey yapmanıza gerek yok.',
  closedCancelledTitle: 'Rezervasyon iptal edildi',
  closedCancelledBody: 'Bu rezervasyon iptal edildi, oda gerekmiyor.',

  successTitle: 'Teşekkür ederiz',
  successBody: 'Yanıtınızı kaydettik ve {operator} firmasına bildirdik.',
  successAlreadyRecorded: 'Bu yanıt zaten kayıtlıydı, hiçbir şey değişmedi.',

  languageSwitcherLabel: 'Dil',
}

const BUNDLES: Record<ReplyLocale, ApprovalReplyBundle> = { en, de, es, it, tr }

/** Normalise an arbitrary locale string ('de-AT', 'ES', …) to a supported bundle key. */
export function normalizeReplyLocale(locale: string | null | undefined): ReplyLocale {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  if (base === 'de' || base === 'en' || base === 'es' || base === 'it' || base === 'tr') return base
  return 'en'
}

/**
 * Generic wording for a manual "Ask partner" request (landr-xtkae.12/.16):
 * the partner may be a driver, so nothing here may talk about rooms, hotels,
 * check-in or nights. Only the keys that differ from the hotel bundle are
 * listed; everything else (errors, comment/name fields, expiry cards, …) is
 * already neutral and falls through.
 */
const PARTNER_OVERRIDES: Record<ReplyLocale, Partial<ApprovalReplyBundle>> = {
  en: {
    pageTitle: 'Booking request',
    checkInLabel: 'From',
    checkOutLabel: 'Until',
    guestsLabel: 'People',
    hotelLabel: 'Partner',
    optionConfirmedTitle: 'Yes, confirmed',
    closedCancelledBody: "This booking was cancelled. You don't need to do anything else.",
  },
  de: {
    pageTitle: 'Buchungsanfrage',
    checkInLabel: 'Von',
    checkOutLabel: 'Bis',
    guestsLabel: 'Personen',
    hotelLabel: 'Partner',
    optionConfirmedTitle: 'Ja, bestätigt',
    closedCancelledBody: 'Diese Buchung wurde storniert. Sie müssen nichts weiter tun.',
  },
  es: {
    pageTitle: 'Solicitud de reserva',
    checkInLabel: 'Desde',
    checkOutLabel: 'Hasta',
    guestsLabel: 'Personas',
    hotelLabel: 'Colaborador',
    optionConfirmedTitle: 'Sí, confirmado',
    closedCancelledBody: 'Esta reserva se ha cancelado. No tiene que hacer nada más.',
  },
  it: {
    pageTitle: 'Richiesta di prenotazione',
    checkInLabel: 'Dal',
    checkOutLabel: 'Al',
    guestsLabel: 'Persone',
    hotelLabel: 'Partner',
    optionConfirmedTitle: 'Sì, confermato',
    closedCancelledBody: 'Questa prenotazione è stata cancellata: non deve fare altro.',
  },
  tr: {
    pageTitle: 'Rezervasyon talebi',
    checkInLabel: 'Başlangıç',
    checkOutLabel: 'Bitiş',
    guestsLabel: 'Kişi',
    hotelLabel: 'İş ortağı',
    optionConfirmedTitle: 'Evet, onaylandı',
    closedCancelledBody: 'Bu rezervasyon iptal edildi, başka bir şey yapmanıza gerek yok.',
  },
}

/** `branch` of the GET payload: only the literal 'partner' switches wording. */
export function isPartnerBranch(branch: string | null | undefined): boolean {
  return branch === 'partner'
}

/**
 * Bundle for a locale. `branch === 'partner'` swaps in the generic partner
 * wording; any other value — including a missing/null `branch` from an API
 * that predates the field — is the unchanged hotel wording.
 */
export function pickReplyBundle(
  locale: string | null | undefined,
  branch?: string | null,
): ApprovalReplyBundle {
  const base = BUNDLES[normalizeReplyLocale(locale)]
  if (!isPartnerBranch(branch)) return base
  return { ...base, ...PARTNER_OVERRIDES[normalizeReplyLocale(locale)] }
}

/** Substitute `{key}` placeholders in a bundle string. Unknown keys are left as-is. */
export function fmt(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  )
}
