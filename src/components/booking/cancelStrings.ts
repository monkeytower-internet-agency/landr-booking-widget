/**
 * Page-scoped de/en/es strings for CancelPage (landr-5aih0.7).
 *
 * Same reasoning as approvalReplyStrings.ts: the customer arrives from a
 * booking email that was sent in de/en/es, so the page speaks the email's
 * language — the preview response's `locale` — rather than the widget's
 * browser-locale chrome. Informal address (du / tú), matching the emails.
 *
 * `{name}` placeholders are filled by `fmtCancel`.
 */

export type CancelLocale = 'de' | 'en' | 'es'

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
  confirmBody: string
  yes: string
  busy: string
  no: string
  tooLateTitle: string
  tooLateBody: string
  tooLateBodyNoDeadline: string
  contactCall: string
  contactEmail: string
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
    'The cancellation link may have expired or been replaced. Please contact the company you booked with.',
  title: 'Cancel your booking?',
  bookingRef: 'Booking {ref}',
  freeUntil: 'Free cancellation until {deadline}.',
  refundStripe: 'You will get {amount} back to your original payment method.',
  refundManual: '{operator} will refund {amount} to you directly.',
  refundNone: 'You have not been charged, so there is nothing to refund.',
  confirmBody: 'This cancels your booking right away. You cannot undo this.',
  yes: 'Yes, cancel booking',
  busy: 'Cancelling…',
  no: 'No, keep booking',
  tooLateTitle: 'This booking can no longer be cancelled online',
  tooLateBody:
    'Free cancellation was possible until {deadline}. Please contact {operator} to change or cancel your booking.',
  tooLateBodyNoDeadline:
    'Please contact {operator} to change or cancel your booking.',
  contactCall: 'Call {phone}',
  contactEmail: 'Email {email}',
  alreadyTitle: 'This booking is already cancelled',
  successTitle: 'Booking cancelled',
  successBody:
    'Your booking has been cancelled. We have sent you a confirmation email.',
  successRefunded: 'Your refund is on its way to your original payment method.',
  successManual: '{operator} will contact you about your refund.',
  errorTitle: 'Cancellation failed',
  errorBody:
    'We could not cancel this booking. Please try again, or contact {operator}.',
  tryAgain: 'Try again',
}

const de: CancelBundle = {
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
  refundNone: 'Dir wurde nichts berechnet, daher gibt es nichts zu erstatten.',
  confirmBody:
    'Deine Buchung wird sofort storniert. Das lässt sich nicht rückgängig machen.',
  yes: 'Ja, Buchung stornieren',
  busy: 'Wird storniert …',
  no: 'Nein, Buchung behalten',
  tooLateTitle: 'Diese Buchung kann nicht mehr online storniert werden',
  tooLateBody:
    'Die kostenlose Stornierung war bis {deadline} möglich. Bitte wende dich an {operator}, um deine Buchung zu ändern oder zu stornieren.',
  tooLateBodyNoDeadline:
    'Bitte wende dich an {operator}, um deine Buchung zu ändern oder zu stornieren.',
  contactCall: 'Anrufen: {phone}',
  contactEmail: 'E-Mail: {email}',
  alreadyTitle: 'Diese Buchung ist bereits storniert',
  successTitle: 'Buchung storniert',
  successBody:
    'Deine Buchung wurde storniert. Wir haben dir eine Bestätigung per E-Mail geschickt.',
  successRefunded:
    'Deine Erstattung ist auf dem Weg zu deinem ursprünglichen Zahlungsmittel.',
  successManual: '{operator} meldet sich wegen deiner Erstattung bei dir.',
  errorTitle: 'Stornierung fehlgeschlagen',
  errorBody:
    'Wir konnten diese Buchung nicht stornieren. Bitte versuche es erneut oder wende dich an {operator}.',
  tryAgain: 'Erneut versuchen',
}

const es: CancelBundle = {
  loadingTitle: 'Cargando tu reserva…',
  invalidTitle: 'Este enlace ya no es válido',
  invalidBody:
    'Es posible que el enlace de cancelación haya caducado o se haya sustituido. Ponte en contacto con la empresa con la que reservaste.',
  title: '¿Cancelar tu reserva?',
  bookingRef: 'Reserva {ref}',
  freeUntil: 'Cancelación gratuita hasta el {deadline}.',
  refundStripe: 'Recibirás {amount} en tu método de pago original.',
  refundManual: '{operator} te reembolsará {amount} directamente.',
  refundNone: 'No se te ha cobrado nada, así que no hay nada que reembolsar.',
  confirmBody: 'Tu reserva se cancelará de inmediato. No se puede deshacer.',
  yes: 'Sí, cancelar la reserva',
  busy: 'Cancelando…',
  no: 'No, mantener la reserva',
  tooLateTitle: 'Esta reserva ya no se puede cancelar en línea',
  tooLateBody:
    'La cancelación gratuita era posible hasta el {deadline}. Ponte en contacto con {operator} para cambiar o cancelar tu reserva.',
  tooLateBodyNoDeadline:
    'Ponte en contacto con {operator} para cambiar o cancelar tu reserva.',
  contactCall: 'Llamar al {phone}',
  contactEmail: 'Escribir a {email}',
  alreadyTitle: 'Esta reserva ya está cancelada',
  successTitle: 'Reserva cancelada',
  successBody:
    'Tu reserva ha sido cancelada. Te hemos enviado un correo de confirmación.',
  successRefunded: 'Tu reembolso está en camino a tu método de pago original.',
  successManual: '{operator} se pondrá en contacto contigo para el reembolso.',
  errorTitle: 'No se pudo cancelar',
  errorBody:
    'No hemos podido cancelar esta reserva. Inténtalo de nuevo o ponte en contacto con {operator}.',
  tryAgain: 'Intentar de nuevo',
}

const BUNDLES: Record<CancelLocale, CancelBundle> = { de, en, es }

/** Map any BCP-47-ish code to a supported page locale; English otherwise. */
export function normalizeCancelLocale(code: string | null | undefined): CancelLocale {
  const base = (code ?? '').split('-')[0].trim().toLowerCase()
  return base === 'de' || base === 'es' ? base : 'en'
}

export function pickCancelBundle(locale: CancelLocale): CancelBundle {
  return BUNDLES[locale]
}

/** Fill `{name}` placeholders; unknown names are left as-is. */
export function fmtCancel(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? values[name] : whole,
  )
}
