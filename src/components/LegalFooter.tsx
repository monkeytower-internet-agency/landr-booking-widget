import { browserLocale } from '@/lib/locale'
import { resolveUiLanguage, tr } from '@/lib/strings'

// LANDR's own compliance pages — same targets as the dashboard /today footer.
// The imprint lives at /impressum/ in both languages; the privacy policy has a
// German (/datenschutz/) and an English (/privacy/) page; Spanish and Turkish
// readers get the English page until localized ones exist.
export const IMPRINT_URL = 'https://compliance.landr.de/impressum/'
export const PRIVACY_URL_DE = 'https://compliance.landr.de/datenschutz/'
export const PRIVACY_URL_EN = 'https://compliance.landr.de/privacy/'

/** Imprint · Privacy links under the standalone token pages. */
export function LegalFooter() {
  const locale = browserLocale()
  const linkClass = 'underline-offset-2 hover:text-foreground hover:underline'
  return (
    <footer
      data-testid="legal-footer"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground"
    >
      <a
        href={IMPRINT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        data-testid="legal-footer-imprint"
      >
        {tr('legalImprint', locale)}
      </a>
      <span aria-hidden>·</span>
      <a
        href={resolveUiLanguage(locale) === 'de' ? PRIVACY_URL_DE : PRIVACY_URL_EN}
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
