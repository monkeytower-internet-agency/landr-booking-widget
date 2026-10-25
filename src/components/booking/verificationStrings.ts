/**
 * Page-scoped de/en strings for the registration-verification screens (the
 * documents + waiver section of the review step and the pending panel on the
 * confirmation screen). English is the fallback for every other language.
 */

export interface VerificationBundle {
  heading: string
  intro: string
  licenceLabel: string
  insuranceLabel: string
  fileHint: string
  chooseFile: string
  replaceFile: string
  fileTooLarge: string
  fileWrongType: string
  waiverHeading: string
  waiverFallback: string
  signatureLabel: string
  signaturePlaceholder: string
  acceptLabel: string
  missingHint: string
  uploadFailed: string
  retryUpload: string
  uploading: string
  pendingTitle: string
  pendingBody: string
  approvedBody: string
  rejectedTitle: string
  rejectedNoteLabel: string
  uploadedLabel: string
  missingLabel: string
  needFilesBody: string
}

const en: VerificationBundle = {
  heading: 'Your documents',
  intro:
    'The organizer checks your licence and insurance before your registration is confirmed.',
  licenceLabel: 'Pilot licence',
  insuranceLabel: 'Insurance proof',
  fileHint: 'Photo or PDF, up to 10 MB.',
  chooseFile: 'Choose file',
  replaceFile: 'Replace file',
  fileTooLarge: 'This file is larger than 10 MB.',
  fileWrongType: 'Please choose a photo (JPG, PNG, WebP, HEIC) or a PDF.',
  waiverHeading: 'Waiver',
  waiverFallback: 'I confirm that my documents are valid and that I take part at my own risk.',
  signatureLabel: 'Type your full name to sign',
  signaturePlaceholder: 'Full name',
  acceptLabel: 'I have read the waiver and agree.',
  missingHint: 'Add both documents, type your name and accept the waiver to continue.',
  uploadFailed:
    'Your registration is in, but a document could not be uploaded. Please try again below.',
  retryUpload: 'Upload',
  uploading: 'Uploading…',
  pendingTitle: 'We will confirm once your documents are verified',
  pendingBody:
    'Your registration is in. You will get an email as soon as the organizer has checked your documents.',
  approvedBody: 'Your documents were verified. Your registration is confirmed.',
  rejectedTitle: 'Your registration could not be confirmed',
  rejectedNoteLabel: 'Reason from the organizer:',
  uploadedLabel: 'Received',
  missingLabel: 'Still missing',
  needFilesBody: 'Please upload the missing documents so the organizer can verify you.',
}

const de: VerificationBundle = {
  heading: 'Deine Unterlagen',
  intro:
    'Der Veranstalter prüft Lizenz und Versicherung, bevor deine Anmeldung bestätigt wird.',
  licenceLabel: 'Pilotenlizenz',
  insuranceLabel: 'Versicherungsnachweis',
  fileHint: 'Foto oder PDF, bis 10 MB.',
  chooseFile: 'Datei wählen',
  replaceFile: 'Datei ersetzen',
  fileTooLarge: 'Diese Datei ist größer als 10 MB.',
  fileWrongType: 'Bitte wähle ein Foto (JPG, PNG, WebP, HEIC) oder eine PDF-Datei.',
  waiverHeading: 'Haftungsverzicht',
  waiverFallback:
    'Ich bestätige, dass meine Unterlagen gültig sind und ich auf eigenes Risiko teilnehme.',
  signatureLabel: 'Zum Unterschreiben deinen vollen Namen eintippen',
  signaturePlaceholder: 'Vollständiger Name',
  acceptLabel: 'Ich habe den Haftungsverzicht gelesen und stimme zu.',
  missingHint:
    'Lade beide Unterlagen hoch, tippe deinen Namen und stimme dem Haftungsverzicht zu, um fortzufahren.',
  uploadFailed:
    'Deine Anmeldung ist eingegangen, aber eine Datei konnte nicht hochgeladen werden. Bitte versuche es unten erneut.',
  retryUpload: 'Hochladen',
  uploading: 'Wird hochgeladen…',
  pendingTitle: 'Wir bestätigen, sobald deine Unterlagen geprüft sind',
  pendingBody:
    'Deine Anmeldung ist eingegangen. Du bekommst eine E-Mail, sobald der Veranstalter deine Unterlagen geprüft hat.',
  approvedBody: 'Deine Unterlagen wurden geprüft. Deine Anmeldung ist bestätigt.',
  rejectedTitle: 'Deine Anmeldung konnte nicht bestätigt werden',
  rejectedNoteLabel: 'Begründung des Veranstalters:',
  uploadedLabel: 'Erhalten',
  missingLabel: 'Fehlt noch',
  needFilesBody: 'Bitte lade die fehlenden Unterlagen hoch, damit der Veranstalter dich prüfen kann.',
}

export function verificationStrings(locale?: string): VerificationBundle {
  return (locale ?? '').toLowerCase().startsWith('de') ? de : en
}

/** The waiver language the API stores with the signature. */
export function waiverLocale(locale?: string): 'de' | 'en' {
  return (locale ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}
