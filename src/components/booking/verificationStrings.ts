/**
 * Page-scoped de/en/es/tr strings for the registration-verification screens (the
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

const es: VerificationBundle = {
  heading: 'Tus documentos',
  intro:
    'El organizador revisa tu licencia y tu seguro antes de confirmar tu inscripción.',
  licenceLabel: 'Licencia de piloto',
  insuranceLabel: 'Comprobante del seguro',
  fileHint: 'Foto o PDF, hasta 10 MB.',
  chooseFile: 'Elegir archivo',
  replaceFile: 'Cambiar archivo',
  fileTooLarge: 'Este archivo pesa más de 10 MB.',
  fileWrongType: 'Elige una foto (JPG, PNG, WebP, HEIC) o un PDF.',
  waiverHeading: 'Exención de responsabilidad',
  waiverFallback:
    'Confirmo que mis documentos son válidos y que participo bajo mi propia responsabilidad.',
  signatureLabel: 'Escribe tu nombre completo para firmar',
  signaturePlaceholder: 'Nombre completo',
  acceptLabel: 'He leído la exención de responsabilidad y la acepto.',
  missingHint:
    'Añade los dos documentos, escribe tu nombre y acepta la exención de responsabilidad para continuar.',
  uploadFailed:
    'Tu inscripción está registrada, pero no se ha podido subir un documento. Inténtalo de nuevo más abajo.',
  retryUpload: 'Subir',
  uploading: 'Subiendo…',
  pendingTitle: 'Te confirmaremos cuando se verifiquen tus documentos',
  pendingBody:
    'Tu inscripción está registrada. Recibirás un correo en cuanto el organizador haya revisado tus documentos.',
  approvedBody: 'Tus documentos se han verificado. Tu inscripción está confirmada.',
  rejectedTitle: 'No se ha podido confirmar tu inscripción',
  rejectedNoteLabel: 'Motivo del organizador:',
  uploadedLabel: 'Recibido',
  missingLabel: 'Aún falta',
  needFilesBody: 'Sube los documentos que faltan para que el organizador pueda verificarte.',
}

const tr: VerificationBundle = {
  heading: 'Belgeleriniz',
  intro:
    'Organizatör, kaydınızı onaylamadan önce lisansınızı ve sigortanızı kontrol eder.',
  licenceLabel: 'Pilot lisansı',
  insuranceLabel: 'Sigorta belgesi',
  fileHint: 'Fotoğraf veya PDF, en fazla 10 MB.',
  chooseFile: 'Dosya seç',
  replaceFile: 'Dosyayı değiştir',
  fileTooLarge: 'Bu dosya 10 MB’tan büyük.',
  fileWrongType: 'Lütfen bir fotoğraf (JPG, PNG, WebP, HEIC) veya PDF seçin.',
  waiverHeading: 'Sorumluluk feragatnamesi',
  waiverFallback:
    'Belgelerimin geçerli olduğunu ve etkinliğe kendi sorumluluğumda katıldığımı onaylıyorum.',
  signatureLabel: 'İmzalamak için adınızı ve soyadınızı yazın',
  signaturePlaceholder: 'Ad Soyad',
  acceptLabel: 'Feragatnameyi okudum ve kabul ediyorum.',
  missingHint:
    'Devam etmek için iki belgeyi de ekleyin, adınızı yazın ve feragatnameyi kabul edin.',
  uploadFailed:
    'Kaydınız alındı, ancak bir belge yüklenemedi. Lütfen aşağıdan tekrar deneyin.',
  retryUpload: 'Yükle',
  uploading: 'Yükleniyor…',
  pendingTitle: 'Belgeleriniz doğrulandığında onaylayacağız',
  pendingBody:
    'Kaydınız alındı. Organizatör belgelerinizi kontrol eder etmez bir e-posta alacaksınız.',
  approvedBody: 'Belgeleriniz doğrulandı. Kaydınız onaylandı.',
  rejectedTitle: 'Kaydınız onaylanamadı',
  rejectedNoteLabel: 'Organizatörün gerekçesi:',
  uploadedLabel: 'Alındı',
  missingLabel: 'Hâlâ eksik',
  needFilesBody: 'Organizatörün sizi doğrulayabilmesi için lütfen eksik belgeleri yükleyin.',
}

export function verificationStrings(locale?: string): VerificationBundle {
  const base = (locale ?? '').toLowerCase()
  if (base.startsWith('de')) return de
  if (base.startsWith('es')) return es
  if (base.startsWith('tr')) return tr
  return en
}

/**
 * The waiver language the API stores with the signature. The operator only
 * writes the waiver text in German and English, so es / tr customers sign the
 * English text.
 */
export function waiverLocale(locale?: string): 'de' | 'en' {
  return (locale ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}
