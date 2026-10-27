import { useState } from "react";
import { Moon, PartyPopper, Sun } from "lucide-react";
import { Confirmation } from "@/components/booking/Confirmation";
import type { SubmitBookingResponse } from "@/api/types";
import { Button } from "@/components/ui/button";
import { DEMO_LANGS, demoCopy, demoLang, demoSignupUrl } from "@/lib/demo";

const DEMO_LANG_LABEL: Record<string, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  tr: "Türkçe",
};

/** Language + light/dark switch, right-aligned under the banner. */
function DemoControls() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };
  const changeLang = (lang: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.location.assign(url.toString());
  };
  return (
    <div className="flex items-center justify-end gap-2" data-testid="demo-controls">
      <select
        aria-label="Language"
        className="border-border bg-card text-foreground h-9 rounded-md border px-2 text-sm"
        data-testid="demo-lang"
        value={demoLang()}
        onChange={(e) => changeLang(e.target.value)}
      >
        {DEMO_LANGS.map((l) => (
          <option key={l} value={l}>
            {DEMO_LANG_LABEL[l]}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="icon"
        aria-label={dark ? "Light mode" : "Dark mode"}
        data-testid="demo-theme"
        onClick={toggleTheme}
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  );
}

/** Persistent "Demo" label shown above every step of a demo embed. */
export function DemoBanner() {
  const copy = demoCopy();
  return (
    <div className="flex flex-col gap-2">
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
      <DemoControls />
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
            hideRestart
            operatorName={operatorName ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}
