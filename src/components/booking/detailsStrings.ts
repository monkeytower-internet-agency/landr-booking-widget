/**
 * Page-scoped de/en strings for the customer-completes-forms surface
 * (landr-kcxx5.4): the /details/{token} page and the inline step on the offer
 * page. Chrome follows the resolved customer locale (German UI tier,
 * landr-5aih0.9); the operator-authored form content follows CustomFormStep's
 * own locale rule. `{name}` placeholders are filled by `fmtDetails`.
 */
import { isGermanLocale } from '@/lib/strings'

export interface DetailsBundle {
  pageTitle: string
  loadingTitle: string
  loadingBody: string
  invalidTitle: string
  invalidBody: string
  errorTitle: string
  errorBody: string
  retry: string
  nothingTitle: string
  nothingBody: string
  nothingBodyNoOperator: string
  doneTitle: string
  doneBody: string
  doneBodyNoOperator: string
  intro: string
  introNoOperator: string
  inlineIntro: string
  inlineIntroNoOperator: string
  stepCounter: string
  submit: string
  submitAndAccept: string
  saving: string
  problemsTitle: string
  saveFailed: string
  bookingClosed: string
}

const en: DetailsBundle = {
  pageTitle: 'Your details',
  loadingTitle: 'Loading your questions…',
  loadingBody: 'One moment, please.',
  invalidTitle: 'This link is no longer valid',
  invalidBody:
    'The link may have expired or been replaced. Please contact the company you booked with.',
  errorTitle: 'Something went wrong',
  errorBody: 'We could not load your questions. Please try again in a moment.',
  retry: 'Try again',
  nothingTitle: 'Nothing to complete',
  nothingBody: 'There is nothing left for you to fill in. {operator} already has everything they need.',
  nothingBodyNoOperator: 'There is nothing left for you to fill in. The organiser already has everything they need.',
  doneTitle: 'Thanks — your details are saved',
  doneBody: 'We have passed them on to {operator}. You can close this page.',
  doneBodyNoOperator: 'We have passed them on. You can close this page.',
  intro: 'Please answer the questions below for your booking with {operator}.',
  introNoOperator: 'Please answer the questions below for your booking.',
  inlineIntro: 'Before you accept, {operator} needs a few details from you.',
  inlineIntroNoOperator: 'Before you accept, we need a few details from you.',
  stepCounter: 'Form {n} of {total}',
  submit: 'Submit',
  submitAndAccept: 'Save and accept',
  saving: 'Saving…',
  problemsTitle: 'Please check these answers',
  saveFailed: 'We could not save your details. Please try again.',
  bookingClosed: 'This booking is closed, so details can no longer be added.',
}

const de: DetailsBundle = {
  pageTitle: 'Ihre Angaben',
  loadingTitle: 'Ihre Fragen werden geladen …',
  loadingBody: 'Einen Moment bitte.',
  invalidTitle: 'Dieser Link ist nicht mehr gültig',
  invalidBody:
    'Der Link ist möglicherweise abgelaufen oder wurde ersetzt. Bitte wenden Sie sich an das Unternehmen, bei dem Sie gebucht haben.',
  errorTitle: 'Etwas ist schiefgelaufen',
  errorBody: 'Ihre Fragen konnten nicht geladen werden. Bitte versuchen Sie es gleich noch einmal.',
  retry: 'Erneut versuchen',
  nothingTitle: 'Nichts mehr auszufüllen',
  nothingBody: 'Sie müssen nichts mehr ausfüllen. {operator} hat bereits alles, was benötigt wird.',
  nothingBodyNoOperator: 'Sie müssen nichts mehr ausfüllen. Der Veranstalter hat bereits alles, was benötigt wird.',
  doneTitle: 'Danke – Ihre Angaben sind gespeichert',
  doneBody: 'Wir haben sie an {operator} weitergegeben. Sie können diese Seite schließen.',
  doneBodyNoOperator: 'Wir haben sie weitergegeben. Sie können diese Seite schließen.',
  intro: 'Bitte beantworten Sie die folgenden Fragen zu Ihrer Buchung bei {operator}.',
  introNoOperator: 'Bitte beantworten Sie die folgenden Fragen zu Ihrer Buchung.',
  inlineIntro: 'Bevor Sie annehmen, benötigt {operator} noch ein paar Angaben von Ihnen.',
  inlineIntroNoOperator: 'Bevor Sie annehmen, benötigen wir noch ein paar Angaben von Ihnen.',
  stepCounter: 'Formular {n} von {total}',
  submit: 'Absenden',
  submitAndAccept: 'Speichern und annehmen',
  saving: 'Wird gespeichert …',
  problemsTitle: 'Bitte prüfen Sie diese Angaben',
  saveFailed: 'Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  bookingClosed: 'Diese Buchung ist abgeschlossen, daher können keine Angaben mehr ergänzt werden.',
}

export function pickDetailsBundle(locale?: string): DetailsBundle {
  return isGermanLocale(locale) ? de : en
}

/** Fill `{name}` placeholders; unknown names are left as-is. */
export function fmtDetails(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? values[name] : whole,
  )
}
