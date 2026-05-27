/**
 * LandingPage — shown when the widget is loaded without a valid operator
 * token (?w= param missing or the API returned 404 for the given token).
 * It deliberately avoids referencing any operator so it works as a neutral
 * host-page placeholder. (landr-il9f.2)
 */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">
        This is the booking-widget host for Landr
      </h1>
      <a
        href="https://www.landr.de"
        className="text-primary underline underline-offset-4"
      >
        www.landr.de
      </a>
    </div>
  )
}
