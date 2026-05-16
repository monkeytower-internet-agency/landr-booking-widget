# landr-booking-widget

Customer-facing booking widget embedded in operator websites (e.g. Para42's WordPress site) via a ~20-line PHP plugin that drops it in an iframe.

**Stack:** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Decision recap: [`../decisions/2026-05-13-dashboard-stack.md`](../decisions/2026-05-13-dashboard-stack.md).

**Hosting:** Cloudflare Pages at `bw.landr.de` (wired in landr-e10.5).

## Setup

```bash
npm install
cp .env.example .env       # edit VITE_API_BASE_URL if needed
```

## Develop

```bash
npm run dev                # http://localhost:5173
```

## Verify

```bash
npm run typecheck          # tsc -b --noEmit
npm run lint               # eslint
npm run build              # production build into dist/
npm run preview            # serve dist/
```

## Embedding

The widget is loaded by Para42's WordPress site via the shortcode `[landr_booking operator="para42"]` (plugin lives in `wp-plugin/`). Query params understood by the widget:

- `operator` — operator slug (defaults to `VITE_DEFAULT_OPERATOR_SLUG`)
- `product` — optional pre-selected product slug

## Repo layout

```
src/
  components/ui/   shadcn/ui primitives
  lib/utils.ts     cn() helper
  App.tsx          entry — customer flow lands in landr-e10.2
wp-plugin/         WordPress plugin (landr-e10.4)
```
