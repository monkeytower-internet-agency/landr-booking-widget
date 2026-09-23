import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'

/**
 * LandingPage — shown when the widget is loaded without a valid operator
 * token (?w= param missing or the API returned 404 for the given token).
 * It deliberately avoids referencing any operator so it works as a neutral
 * host-page placeholder. (landr-il9f.2)
 *
 * landr-5aih0.17: no operator resolves here (invalid/missing token), so
 * there is no customer_languages whitelist to consult — browserLocale()
 * with no whitelist configured falls back to the raw navigator locale
 * (see src/lib/locale.ts), which is all this neutral page needs.
 */
export function LandingPage() {
  const locale = browserLocale()
  return (
    <div className="flex min-h-screen embedded:min-h-0 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{tr('landingPageTitle', locale)}</h1>
      <a
        href="https://www.landr.de"
        className="text-primary underline underline-offset-4"
      >
        www.landr.de
      </a>
    </div>
  )
}
