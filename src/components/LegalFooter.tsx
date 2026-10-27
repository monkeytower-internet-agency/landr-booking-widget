import { browserLocale } from '@/lib/locale'
import { resolveUiLanguage, tr } from '@/lib/strings'

// LANDR's own compliance pages — same targets as the dashboard /today footer.
// German and English readers share the German imprint (/impressum/); the privacy
// policy has a German (/datenschutz/) and an English (/privacy/) page. Spanish
// and Turkish readers get their own (machine-translated) imprint and privacy
// pages; any other language falls back to the English privacy policy.
const COMPLIANCE = 'https://compliance.landr.de'
export const IMPRINT_URL = `${COMPLIANCE}/impressum/`
export const PRIVACY_URL_DE = `${COMPLIANCE}/datenschutz/`
export const PRIVACY_URL_EN = `${COMPLIANCE}/privacy/`

const IMPRINT_URLS: Record<string, string> = {
  es: `${COMPLIANCE}/es/impressum/`,
  tr: `${COMPLIANCE}/tr/impressum/`,
}
const PRIVACY_URLS: Record<string, string> = {
  de: PRIVACY_URL_DE,
  es: `${COMPLIANCE}/es/privacy/`,
  tr: `${COMPLIANCE}/tr/privacy/`,
}

/** Imprint · Privacy links under the standalone token pages. */
export function LegalFooter() {
  const locale = browserLocale()
  const lang = resolveUiLanguage(locale)
  const linkClass = 'underline-offset-2 hover:text-foreground hover:underline'
  return (
    <footer
      data-testid="legal-footer"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground"
    >
      <a
        href={IMPRINT_URLS[lang] ?? IMPRINT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        data-testid="legal-footer-imprint"
      >
        {tr('legalImprint', locale)}
      </a>
      <span aria-hidden>·</span>
      <a
        href={PRIVACY_URLS[lang] ?? PRIVACY_URL_EN}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        data-testid="legal-footer-privacy"
      >
        {tr('legalPrivacy', locale)}
      </a>
    </footer>
  )
}
