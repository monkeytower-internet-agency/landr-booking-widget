import { PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { demoCopy, demoLang, demoSignupUrl } from '@/lib/demo'

/** Persistent "Demo" label shown above every step of a demo embed. */
export function DemoBanner() {
  const copy = demoCopy()
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      data-testid="demo-banner"
      role="status"
    >
      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide">
        {copy.badge}
      </span>
      <span>{copy.banner}</span>
    </div>
  )
}

/** Replaces the booking confirmation in demo mode: no booking exists. */
export function DemoCongrats({ slug, onRestart }: { slug: string; onRestart: () => void }) {
  const copy = demoCopy()
  return (
    <section
      className="border-border bg-card flex flex-col items-center gap-4 rounded-lg border p-8 text-center"
      data-testid="demo-congrats"
    >
      <PartyPopper className="text-primary size-10" aria-hidden="true" />
      <h2 className="text-2xl font-semibold">{copy.congratsTitle}</h2>
      <p className="text-muted-foreground max-w-prose text-sm">{copy.congratsBody}</p>
      <Button asChild size="lg">
        <a href={demoSignupUrl(slug, demoLang())} target="_top" data-testid="demo-congrats-cta">
          {copy.cta}
        </a>
      </Button>
      <Button variant="ghost" onClick={onRestart} data-testid="demo-congrats-restart">
        {copy.again}
      </Button>
    </section>
  )
}
