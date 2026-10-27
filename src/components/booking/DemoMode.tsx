import { PartyPopper } from "lucide-react";
import { Confirmation } from "@/components/booking/Confirmation";
import type { SubmitBookingResponse } from "@/api/types";
import { Button } from "@/components/ui/button";
import { demoCopy, demoLang, demoSignupUrl } from "@/lib/demo";

/** Persistent "Demo" label shown above every step of a demo embed. */
export function DemoBanner() {
  const copy = demoCopy();
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
  );
}

/** Replaces the booking confirmation in demo mode: no booking exists. */
export function DemoCongrats({
  slug,
  onRestart,
  response,
  operatorName,
}: {
  slug: string;
  onRestart: () => void;
  response?: SubmitBookingResponse;
  operatorName?: string | null;
}) {
  const copy = demoCopy();
  return (
    <div className="flex flex-col gap-6" data-testid="demo-congrats">
      <section className="border-border bg-card flex flex-col items-center gap-4 rounded-lg border p-8 text-center">
        <PartyPopper className="text-primary size-10" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">{copy.congratsTitle}</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          {copy.congratsBody}
        </p>
        <Button asChild size="lg">
          <a
            href={demoSignupUrl(slug, demoLang())}
            target="_top"
            data-testid="demo-congrats-cta"
          >
            {copy.cta}
          </a>
        </Button>
        <Button
          variant="ghost"
          onClick={onRestart}
          data-testid="demo-congrats-restart"
        >
          {copy.again}
        </Button>
      </section>
      {response?.summary ? (
        <div data-testid="demo-overview" className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
            {copy.congratsOverview}
          </h3>
          <Confirmation
            response={response}
            onRestart={onRestart}
            operatorName={operatorName ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}
