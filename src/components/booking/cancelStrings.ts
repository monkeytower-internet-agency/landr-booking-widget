/**
 * Page-scoped de/en/es/it/tr strings for CancelPage (landr-5aih0.7).
 *
 * Same reasoning as approvalReplyStrings.ts: the customer arrives from a
 * booking email that was sent in de/en/es, so the page speaks the email's
 * language — the preview response's `locale` — rather than the widget's
 * browser-locale chrome. German and Turkish follow the operator's address form (landr-wm0jv): informal
 * du / sen by default, formal "Sie" / "siz" on request; es/it use informal "tú"/"tu".
 *
 * `{name}` placeholders are filled by `fmtCancel`.
 */

import { getAddressForm } from '@/lib/addressForm'

export type CancelLocale = 'de' | 'en' | 'es' | 'it' | 'tr'

export interface CancelBundle {
  loadingTitle: string
  invalidTitle: string
  invalidBody: string
  title: string
  bookingRef: string
  freeUntil: string
  refundStripe: string
  refundManual: string
  refundNone: string
  depositKept: string
  confirmBody: string
  yes: string
  busy: string
  no: string
  tooLateTitle: string
  tooLateBody: string
  tooLateBodyNoDeadline: string
  contactCall: string
  contactEmail: string
  changeActivityHint: string
  changeActivityHintNoOperator: string
  alreadyTitle: string
  successTitle: string
  successBody: string
  successRefunded: string
  successManual: string
  errorTitle: string
  errorBody: string
  tryAgain: string
}

const en: CancelBundle = {
  loadingTitle: 'Loading your booking…',
  invalidTitle: 'This link is no longer valid',
  invalidBody:
    'The cancellation link may have expired or been replaced. Contact the company you booked with.',
  title: 'Cancel your booking?',
  bookingRef: 'Booking {ref}',
  freeUntil: 'Free cancellation until {deadline}.',
  refundStripe: 'You will get {amount} back to your original payment method.',
  refundManual: '{operator} will refund {amount} to you directly.',
  refundNone: "You haven't been charged, so there's nothing to refund.",
  depositKept: 'The {amount} deposit is non-refundable.',
  confirmBody: "Your booking will be cancelled right away. This can't be undone.",
  yes: 'Yes, cancel booking',
  busy: 'Cancelling…',
  no: 'No, keep booking',
  tooLateTitle: 'This booking can no longer be cancelled online',
  tooLateBody:
    'Free cancellation was available until {deadline}. Contact {operator} to change or cancel your booking.',
  tooLateBodyNoDeadline:
    'Contact {operator} to change or cancel your booking.',
  contactCall: 'Call {phone}',
  contactEmail: 'Email {email}',
  changeActivityHint: 'Want a different activity? Contact {operator} to change it.',
  changeActivityHintNoOperator: 'Want a different activity? Contact the operator to change it.',
  alreadyTitle: 'This booking is already cancelled',
  successTitle: 'Booking cancelled',
  successBody:
    "Your booking is cancelled. We've sent you a confirmation email.",
  successRefunded: 'Your refund is on its way to your original payment method.',
  successManual: '{operator} will contact you about your refund.',
  errorTitle: 'Cancellation failed',
  errorBody:
    "We couldn't cancel this booking. Try again or contact {operator}.",
  tryAgain: 'Try again',
}

const de: CancelBundle = {
  loadingTitle: 'Ihre Buchung wird geladen …',
  invalidTitle: 'Dieser Link ist nicht mehr gültig',
  invalidBody:
    'Der Stornierungslink ist abgelaufen oder wurde ersetzt. Bitte wenden Sie sich an den Anbieter, bei dem Sie gebucht haben.',
  title: 'Buchung stornieren?',
  bookingRef: 'Buchung {ref}',
  freeUntil: 'Kostenlose Stornierung bis {deadline}.',
  refundStripe:
    'Sie erhalten {amount} auf Ihr ursprüngliches Zahlungsmittel zurück.',
  refundManual: '{operator} erstattet Ihnen {amount} direkt.',
  refundNone: 'Ihnen wurde nichts berechnet, es gibt also nichts zu erstatten.',
  depositKept: 'Die Anzahlung von {amount} wird nicht erstattet.',
  confirmBody:
    'Ihre Buchung wird sofort storniert. Das lässt sich nicht rückgängig machen.',
  yes: 'Ja, Buchung stornieren',
  busy: 'Wird storniert …',
  no: 'Nein, Buchung behalten',
  tooLateTitle: 'Diese Buchung kann nicht mehr online storniert werden',
  tooLateBody:
    'Eine kostenlose Stornierung war bis {deadline} möglich. Wenden Sie sich an {operator}, um Ihre Buchung zu ändern oder zu stornieren.',
  tooLateBodyNoDeadline:
    'Wenden Sie sich an {operator}, um Ihre Buchung zu ändern oder zu stornieren.',
  contactCall: 'Anrufen: {phone}',
  contactEmail: 'E-Mail: {email}',
  changeActivityHint: 'Lieber eine andere Aktivität? Wenden Sie sich an {operator}, um sie zu ändern.',
  changeActivityHintNoOperator: 'Lieber eine andere Aktivität? Wenden Sie sich an den Anbieter, um sie zu ändern.',
  alreadyTitle: 'Diese Buchung ist bereits storniert',
  successTitle: 'Buchung storniert',
  successBody:
    'Ihre Buchung wurde storniert. Wir haben Ihnen eine Bestätigung per E-Mail geschickt.',
  successRefunded:
    'Die Erstattung geht an Ihr ursprüngliches Zahlungsmittel.',
  successManual: '{operator} meldet sich wegen der Erstattung bei Ihnen.',
  errorTitle: 'Stornierung fehlgeschlagen',
  errorBody:
    'Wir konnten diese Buchung nicht stornieren. Bitte versuchen Sie es erneut oder wenden Sie sich an {operator}.',
  tryAgain: 'Erneut versuchen',
}

const deInformal: CancelBundle = {
  loadingTitle: 'Deine Buchung wird geladen …',
  invalidTitle: 'Dieser Link ist nicht mehr gültig',
  invalidBody:
    'Der Stornierungslink ist abgelaufen oder wurde ersetzt. Bitte wende dich an den Anbieter, bei dem du gebucht hast.',
  title: 'Buchung stornieren?',
  bookingRef: 'Buchung {ref}',
  freeUntil: 'Kostenlose Stornierung bis {deadline}.',
  refundStripe:
    'Du erhältst {amount} auf dein ursprüngliches Zahlungsmittel zurück.',
  refundManual: '{operator} erstattet dir {amount} direkt.',
  refundNone: 'Dir wurde nichts berechnet, es gibt also nichts zu erstatten.',
  depositKept: 'Die Anzahlung von {amount} wird nicht erstattet.',
  confirmBody:
    'Deine Buchung wird sofort storniert. Das lässt sich nicht rückgängig machen.',
  yes: 'Ja, Buchung stornieren',
  busy: 'Wird storniert …',
  no: 'Nein, Buchung behalten',
  tooLateTitle: 'Diese Buchung kann nicht mehr online storniert werden',
  tooLateBody:
    'Eine kostenlose Stornierung war bis {deadline} möglich. Wende dich an {operator}, um deine Buchung zu ändern oder zu stornieren.',
  tooLateBodyNoDeadline:
    'Wende dich an {operator}, um deine Buchung zu ändern oder zu stornieren.',
  contactCall: 'Anrufen: {phone}',
  contactEmail: 'E-Mail: {email}',
  changeActivityHint: 'Lieber eine andere Aktivität? Wende dich an {operator}, um sie zu ändern.',
  changeActivityHintNoOperator: 'Lieber eine andere Aktivität? Wende dich an den Anbieter, um sie zu ändern.',
  alreadyTitle: 'Diese Buchung ist bereits storniert',
  successTitle: 'Buchung storniert',
  successBody:
    'Deine Buchung wurde storniert. Wir haben dir eine Bestätigung per E-Mail geschickt.',
  successRefunded:
    'Die Erstattung geht an dein ursprüngliches Zahlungsmittel.',
  successManual: '{operator} meldet sich wegen der Erstattung bei dir.',
  errorTitle: 'Stornierung fehlgeschlagen',
  errorBody:
    'Wir konnten diese Buchung nicht stornieren. Bitte versuche es erneut oder wende dich an {operator}.',
  tryAgain: 'Erneut versuchen',
}

const it: CancelBundle = {
  loadingTitle: 'Caricamento della prenotazione…',
  invalidTitle: 'Questo link non è più valido',
  invalidBody:
    'Il link di cancellazione potrebbe essere scaduto o essere stato sostituito. Contatta l\u2019organizzatore con cui hai prenotato.',
  title: 'Vuoi cancellare la prenotazione?',
  bookingRef: 'Prenotazione {ref}',
  freeUntil: 'Cancellazione gratuita fino al {deadline}.',
  refundStripe: 'Riceverai {amount} sul metodo di pagamento che hai usato.',
  refundManual: '{operator} ti rimborserà direttamente {amount}.',
  refundNone: 'Non ti è stato addebitato nulla, quindi non c\u2019è niente da rimborsare.',
  depositKept: 'La caparra di {amount} non è rimborsabile.',
  confirmBody: 'La prenotazione verrà cancellata subito. L\u2019operazione non si può annullare.',
  yes: 'Sì, cancella la prenotazione',
  busy: 'Cancellazione in corso…',
  no: 'No, mantieni la prenotazione',
  tooLateTitle: 'Questa prenotazione non si può più cancellare online',
  tooLateBody:
    'La cancellazione gratuita era possibile fino al {deadline}. Contatta {operator} per modificare o cancellare la prenotazione.',
  tooLateBodyNoDeadline:
    'Contatta {operator} per modificare o cancellare la prenotazione.',
  contactCall: 'Chiama il {phone}',
  contactEmail: 'Scrivi a {email}',
  changeActivityHint: 'Vuoi un\u2019altra attività? Contatta {operator} per cambiarla.',
  changeActivityHintNoOperator: 'Vuoi un\u2019altra attività? Contatta l\u2019organizzatore per cambiarla.',
  alreadyTitle: 'Questa prenotazione è già stata cancellata',
  successTitle: 'Prenotazione cancellata',
  successBody:
    'La prenotazione è stata cancellata. Ti abbiamo inviato un\u2019e-mail di conferma.',
  successRefunded: 'Il rimborso è in arrivo sul metodo di pagamento che hai usato.',
  successManual: '{operator} ti contatterà per il rimborso.',
  errorTitle: 'Cancellazione non riuscita',
  errorBody:
    'Non siamo riusciti a cancellare la prenotazione. Riprova o contatta {operator}.',
  tryAgain: 'Riprova',
}

const es: CancelBundle = {
  loadingTitle: 'Cargando tu reserva…',
  invalidTitle: 'Este enlace ya no es válido',
  invalidBody:
    'Puede que el enlace de cancelación haya caducado o se haya sustituido. Contacta con la empresa con la que reservaste.',
  title: '¿Cancelar tu reserva?',
  bookingRef: 'Reserva {ref}',
  freeUntil: 'Cancelación gratuita hasta el {deadline}.',
  refundStripe: 'Recibirás {amount} en el método de pago que usaste.',
  refundManual: '{operator} te reembolsará {amount} directamente.',
  refundNone: 'No se te ha cobrado nada, así que no hay nada que reembolsar.',
  depositKept: 'El depósito de {amount} no es reembolsable.',
  confirmBody: 'Tu reserva se cancelará de inmediato y no podrás deshacerlo.',
  yes: 'Sí, cancelar la reserva',
  busy: 'Cancelando…',
  no: 'No, mantener la reserva',
  tooLateTitle: 'Esta reserva ya no se puede cancelar en línea',
  tooLateBody:
    'La cancelación gratuita era posible hasta el {deadline}. Contacta con {operator} para cambiar o cancelar tu reserva.',
  tooLateBodyNoDeadline:
    'Contacta con {operator} para cambiar o cancelar tu reserva.',
  contactCall: 'Llamar al {phone}',
  contactEmail: 'Escribir a {email}',
  changeActivityHint: '¿Quieres otra actividad? Contacta con {operator} para cambiarla.',
  changeActivityHintNoOperator: '¿Quieres otra actividad? Contacta con el organizador para cambiarla.',
  alreadyTitle: 'Esta reserva ya está cancelada',
  successTitle: 'Reserva cancelada',
  successBody:
    'Tu reserva se ha cancelado. Te hemos enviado un correo de confirmación.',
  successRefunded: 'Tu reembolso está en camino al método de pago que usaste.',
  successManual: '{operator} se pondrá en contacto contigo para el reembolso.',
  errorTitle: 'No se pudo cancelar',
  errorBody:
    'No hemos podido cancelar esta reserva. Inténtalo de nuevo o contacta con {operator}.',
  tryAgain: 'Intentar de nuevo',
}

const tr: CancelBundle = {
  loadingTitle: 'Rezervasyonunuz yükleniyor…',
  invalidTitle: 'Bu bağlantı artık geçerli değil',
  invalidBody:
    'İptal bağlantısının süresi dolmuş veya yenisiyle değiştirilmiş olabilir. Lütfen rezervasyon yaptığınız firmayla iletişime geçin.',
  title: 'Rezervasyon iptal edilsin mi?',
  bookingRef: 'Rezervasyon {ref}',
  freeUntil: '{deadline} tarihine kadar ücretsiz iptal.',
  refundStripe: '{amount}, ödeme yaptığınız yönteme iade edilecek.',
  refundManual: '{operator}, {amount} tutarını size doğrudan iade edecek.',
  refundNone: 'Sizden ücret alınmadı, bu yüzden iade edilecek bir tutar yok.',
  depositKept: '{amount} tutarındaki ön ödeme iade edilmez.',
  confirmBody: 'Rezervasyonunuz hemen iptal edilecek. Bu işlem geri alınamaz.',
  yes: 'Evet, rezervasyonu iptal et',
  busy: 'İptal ediliyor…',
  no: 'Hayır, rezervasyonu koru',
  tooLateTitle: 'Bu rezervasyon artık çevrimiçi iptal edilemez',
  tooLateBody:
    'Ücretsiz iptal {deadline} tarihine kadar mümkündü. Rezervasyonunuzu değiştirmek veya iptal etmek için {operator} ile iletişime geçin.',
  tooLateBodyNoDeadline:
    'Rezervasyonunuzu değiştirmek veya iptal etmek için {operator} ile iletişime geçin.',
  contactCall: 'Ara: {phone}',
  contactEmail: 'E-posta: {email}',
  changeActivityHint: 'Farklı bir etkinlik mi istiyorsunuz? Değiştirmek için {operator} ile iletişime geçin.',
  changeActivityHintNoOperator: 'Farklı bir etkinlik mi istiyorsunuz? Değiştirmek için işletmeyle iletişime geçin.',
  alreadyTitle: 'Bu rezervasyon zaten iptal edildi',
  successTitle: 'Rezervasyon iptal edildi',
  successBody:
    'Rezervasyonunuz iptal edildi. Size bir onay e-postası gönderdik.',
  successRefunded: 'İadeniz, ödeme yaptığınız yönteme gönderiliyor.',
  successManual: '{operator}, iadeniz için sizinle iletişime geçecek.',
  errorTitle: 'İptal edilemedi',
  errorBody:
    'Bu rezervasyonu iptal edemedik. Tekrar deneyin veya {operator} ile iletişime geçin.',
  tryAgain: 'Tekrar dene',
}

const trInformal: CancelBundle = {
  loadingTitle: 'Rezervasyonun yükleniyor…',
  invalidTitle: 'Bu bağlantı artık geçerli değil',
  invalidBody:
    'İptal bağlantısının süresi dolmuş veya yenisiyle değiştirilmiş olabilir. Lütfen rezervasyon yaptığın firmayla iletişime geç.',
  title: 'Rezervasyon iptal edilsin mi?',
  bookingRef: 'Rezervasyon {ref}',
  freeUntil: '{deadline} tarihine kadar ücretsiz iptal.',
  refundStripe: '{amount}, ödeme yaptığın yönteme iade edilecek.',
  refundManual: '{operator}, {amount} tutarını sana doğrudan iade edecek.',
  refundNone: 'Senden ücret alınmadı, bu yüzden iade edilecek bir tutar yok.',
  depositKept: '{amount} tutarındaki ön ödeme iade edilmez.',
  confirmBody: 'Rezervasyonun hemen iptal edilecek. Bu işlem geri alınamaz.',
  yes: 'Evet, rezervasyonu iptal et',
  busy: 'İptal ediliyor…',
  no: 'Hayır, rezervasyonu koru',
  tooLateTitle: 'Bu rezervasyon artık çevrimiçi iptal edilemez',
  tooLateBody:
    'Ücretsiz iptal {deadline} tarihine kadar mümkündü. Rezervasyonunu değiştirmek veya iptal etmek için {operator} ile iletişime geç.',
  tooLateBodyNoDeadline:
    'Rezervasyonunu değiştirmek veya iptal etmek için {operator} ile iletişime geç.',
  contactCall: 'Ara: {phone}',
  contactEmail: 'E-posta: {email}',
  changeActivityHint: 'Farklı bir etkinlik mi istiyorsun? Değiştirmek için {operator} ile iletişime geç.',
  changeActivityHintNoOperator: 'Farklı bir etkinlik mi istiyorsun? Değiştirmek için işletmeyle iletişime geç.',
  alreadyTitle: 'Bu rezervasyon zaten iptal edildi',
  successTitle: 'Rezervasyon iptal edildi',
  successBody:
    'Rezervasyonun iptal edildi. Sana bir onay e-postası gönderdik.',
  successRefunded: 'İaden, ödeme yaptığın yönteme gönderiliyor.',
  successManual: '{operator}, iaden için seninle iletişime geçecek.',
  errorTitle: 'İptal edilemedi',
  errorBody:
    'Bu rezervasyonu iptal edemedik. Tekrar dene veya {operator} ile iletişime geç.',
  tryAgain: 'Tekrar dene',
}

const BUNDLES: Record<CancelLocale, CancelBundle> = { de, en, es, it, tr }

/** Map any BCP-47-ish code to a supported page locale; English otherwise. */
export function normalizeCancelLocale(code: string | null | undefined): CancelLocale {
  const base = (code ?? '').split('-')[0].trim().toLowerCase()
  return base === 'de' || base === 'es' || base === 'it' || base === 'tr' ? base : 'en'
}

export function pickCancelBundle(locale: CancelLocale): CancelBundle {
  // landr-wm0jv: de/tr follow the operator's address form (default informal).
  if (getAddressForm() === 'informal') {
    if (locale === 'de') return deInformal
    if (locale === 'tr') return trInformal
  }
  return BUNDLES[locale]
}

/** Fill `{name}` placeholders; unknown names are left as-is. */
export function fmtCancel(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? values[name] : whole,
  )
}
