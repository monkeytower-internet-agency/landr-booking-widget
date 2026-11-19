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
  takePhoto: string
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
    'The organizer checks your licence and insurance before confirming your registration.',
  licenceLabel: 'Pilot licence',
  insuranceLabel: 'Proof of insurance',
  fileHint: 'Take a photo, choose one from your library, or upload a PDF (max. 10 MB).',
  chooseFile: 'Choose file',
  replaceFile: 'Replace file',
  takePhoto: 'Take photo',
  fileTooLarge: 'This file is larger than 10 MB.',
  fileWrongType: 'Choose a photo (JPG, PNG, WebP, HEIC) or a PDF.',
  waiverHeading: 'Waiver',
  waiverFallback: 'I confirm that my documents are valid and that I take part at my own risk.',
  signatureLabel: 'Type your full name to sign',
  signaturePlaceholder: 'Full name',
  acceptLabel: "I've read and accept the waiver.",
  missingHint: 'Add both documents, type your name and accept the waiver to continue.',
  uploadFailed:
    "We've received your registration, but one document didn't upload. Try again below.",
  retryUpload: 'Upload',
  uploading: 'Uploading…',
  pendingTitle: "We'll confirm once your documents are checked",
  pendingBody:
    "We've received your registration. You'll get an email as soon as the organizer has checked your documents.",
  approvedBody: 'Your documents are verified and your registration is confirmed.',
  rejectedTitle: "We couldn't confirm your registration",
  rejectedNoteLabel: "Organizer's reason:",
  uploadedLabel: 'Received',
  missingLabel: 'Still missing',
  needFilesBody: 'Upload the missing documents so the organizer can check them.',
}

const de: VerificationBundle = {
  heading: 'Ihre Unterlagen',
  intro:
    'Der Veranstalter prüft Ihre Lizenz und Versicherung, bevor er Ihre Anmeldung bestätigt.',
  licenceLabel: 'Pilotenlizenz',
  insuranceLabel: 'Versicherungsnachweis',
  fileHint: 'Foto aufnehmen, aus der Galerie wählen oder PDF hochladen (max. 10 MB).',
  chooseFile: 'Datei wählen',
  replaceFile: 'Datei ersetzen',
  takePhoto: 'Foto aufnehmen',
  fileTooLarge: 'Diese Datei ist größer als 10 MB.',
  fileWrongType: 'Bitte wählen Sie ein Foto (JPG, PNG, WebP, HEIC) oder eine PDF-Datei.',
  waiverHeading: 'Haftungsverzicht',
  waiverFallback:
    'Ich bestätige, dass meine Unterlagen gültig sind und ich auf eigenes Risiko teilnehme.',
  signatureLabel: 'Geben Sie zum Unterschreiben Ihren vollständigen Namen ein',
  signaturePlaceholder: 'Vollständiger Name',
  acceptLabel: 'Ich habe den Haftungsverzicht gelesen und stimme zu.',
  missingHint:
    'Laden Sie beide Unterlagen hoch, geben Sie Ihren Namen ein und stimmen Sie dem Haftungsverzicht zu, um fortzufahren.',
  uploadFailed:
    'Ihre Anmeldung ist eingegangen, aber eine Datei ließ sich nicht hochladen. Bitte versuchen Sie es unten erneut.',
  retryUpload: 'Hochladen',
  uploading: 'Wird hochgeladen…',
  pendingTitle: 'Wir bestätigen, sobald Ihre Unterlagen geprüft sind',
  pendingBody:
    'Ihre Anmeldung ist eingegangen. Sie erhalten eine E-Mail, sobald der Veranstalter Ihre Unterlagen geprüft hat.',
  approvedBody: 'Ihre Unterlagen sind geprüft und Ihre Anmeldung ist bestätigt.',
  rejectedTitle: 'Ihre Anmeldung konnte nicht bestätigt werden',
  rejectedNoteLabel: 'Begründung des Veranstalters:',
  uploadedLabel: 'Erhalten',
  missingLabel: 'Fehlt noch',
  needFilesBody: 'Bitte laden Sie die fehlenden Unterlagen hoch, damit der Veranstalter sie prüfen kann.',
}

const it: VerificationBundle = {
  heading: 'I tuoi documenti',
  intro:
    'L\u2019organizzatore controlla licenza e assicurazione prima di confermare la tua iscrizione.',
  licenceLabel: 'Licenza di pilota',
  insuranceLabel: 'Attestato di assicurazione',
  fileHint: 'Foto o PDF, fino a 10 MB.',
  chooseFile: 'Scegli file',
  takePhoto: 'Scatta una foto',
  replaceFile: 'Sostituisci file',
  fileTooLarge: 'Questo file supera i 10 MB.',
  fileWrongType: 'Scegli una foto (JPG, PNG, WebP, HEIC) o un PDF.',
  waiverHeading: 'Liberatoria',
  // Kept in English on purpose: the signature record stores waiver_locale 'en' for es/it/tr
  // (waiverLocale() only knows de/en), so the signed text must match that locale.
  waiverFallback: 'I confirm that my documents are valid and that I take part at my own risk.',
  signatureLabel: 'Scrivi il tuo nome completo per firmare',
  signaturePlaceholder: 'Nome completo',
  acceptLabel: 'Ho letto e accetto la liberatoria.',
  missingHint:
    'Aggiungi entrambi i documenti, scrivi il tuo nome e accetta la liberatoria per continuare.',
  uploadFailed:
    'Abbiamo ricevuto la tua iscrizione, ma un documento non è stato caricato. Riprova qui sotto.',
  retryUpload: 'Carica',
  uploading: 'Caricamento in corso…',
  pendingTitle: 'Confermeremo l\u2019iscrizione dopo aver verificato i documenti',
  pendingBody:
    'Abbiamo ricevuto la tua iscrizione. Riceverai un\u2019e-mail appena l\u2019organizzatore avrà controllato i documenti.',
  approvedBody: 'Documenti verificati: la tua iscrizione è confermata.',
  rejectedTitle: 'Non abbiamo potuto confermare la tua iscrizione',
  rejectedNoteLabel: 'Motivo dell\u2019organizzatore:',
  uploadedLabel: 'Ricevuto',
  missingLabel: 'Manca ancora',
  needFilesBody: 'Carica i documenti mancanti, così l\u2019organizzatore potrà verificarli.',
}

const es: VerificationBundle = {
  heading: 'Tus documentos',
  intro:
    'El organizador revisa tu licencia y tu seguro antes de confirmar tu inscripción.',
  licenceLabel: 'Licencia de piloto',
  insuranceLabel: 'Justificante del seguro',
  fileHint: 'Foto o PDF, hasta 10 MB.',
  chooseFile: 'Elegir archivo',
  replaceFile: 'Cambiar archivo',
  takePhoto: 'Hacer foto',
  fileTooLarge: 'Este archivo pesa más de 10 MB.',
  fileWrongType: 'Elige una foto (JPG, PNG, WebP, HEIC) o un PDF.',
  waiverHeading: 'Exención de responsabilidad',
  // Kept in English on purpose: the signature record stores waiver_locale 'en' for es/tr
  // (waiverLocale() only knows de/en), so the signed text must match that locale.
  waiverFallback: 'I confirm that my documents are valid and that I take part at my own risk.',
  signatureLabel: 'Escribe tu nombre completo para firmar',
  signaturePlaceholder: 'Nombre completo',
  acceptLabel: 'He leído la exención de responsabilidad y la acepto.',
  missingHint:
    'Añade los dos documentos, escribe tu nombre y acepta la exención de responsabilidad para continuar.',
  uploadFailed:
    'Hemos recibido tu inscripción, pero un documento no se ha subido. Inténtalo de nuevo abajo.',
  retryUpload: 'Subir',
  uploading: 'Subiendo…',
  pendingTitle: 'Te confirmaremos cuando se verifiquen tus documentos',
  pendingBody:
    'Hemos recibido tu inscripción. Te llegará un correo en cuanto el organizador revise tus documentos.',
  approvedBody: 'Tus documentos están verificados y tu inscripción está confirmada.',
  rejectedTitle: 'No se ha podido confirmar tu inscripción',
  rejectedNoteLabel: 'Motivo del organizador:',
  uploadedLabel: 'Recibido',
  missingLabel: 'Falta',
  needFilesBody: 'Sube los documentos que faltan para que el organizador pueda revisarlos.',
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
  takePhoto: 'Fotoğraf çek',
  fileTooLarge: 'Bu dosya 10 MB’tan büyük.',
  fileWrongType: 'Lütfen bir fotoğraf (JPG, PNG, WebP, HEIC) veya PDF seçin.',
  waiverHeading: 'Sorumluluk feragatnamesi',
  // Kept in English on purpose: see the es bundle — waiver_locale is 'en' for tr too.
  waiverFallback: 'I confirm that my documents are valid and that I take part at my own risk.',
  signatureLabel: 'İmzalamak için adınızı ve soyadınızı yazın',
  signaturePlaceholder: 'Ad Soyad',
  acceptLabel: 'Feragatnameyi okudum ve kabul ediyorum.',
  missingHint:
    'Devam etmek için iki belgeyi de ekleyin, adınızı yazın ve feragatnameyi kabul edin.',
  uploadFailed:
    'Kaydınız alındı ancak bir belge yüklenemedi. Aşağıdan tekrar deneyin.',
  retryUpload: 'Yükle',
  uploading: 'Yükleniyor…',
  pendingTitle: 'Belgeleriniz doğrulanınca kaydınızı onaylayacağız',
  pendingBody:
    'Kaydınız alındı. Organizatör belgelerinizi kontrol eder etmez bir e-posta alacaksınız.',
  approvedBody: 'Belgeleriniz doğrulandı. Kaydınız onaylandı.',
  rejectedTitle: 'Kaydınız onaylanamadı',
  rejectedNoteLabel: 'Organizatörün gerekçesi:',
  uploadedLabel: 'Alındı',
  missingLabel: 'Hâlâ eksik',
  needFilesBody: 'Organizatörün belgelerinizi kontrol edebilmesi için eksik belgeleri yükleyin.',
}

export function verificationStrings(locale?: string): VerificationBundle {
  const base = (locale ?? '').toLowerCase()
  if (base.startsWith('de')) return de
  if (base.startsWith('es')) return es
  if (base.startsWith('it')) return it
  if (base.startsWith('tr')) return tr
  return en
}

/**
 * The waiver language the API stores with the signature. The operator only
 * writes the waiver text in German and English, so es / it / tr customers sign the
 * English text.
 */
export function waiverLocale(locale?: string): 'de' | 'en' {
  return (locale ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}
