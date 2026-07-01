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

## Types

`src/types/database.gen.ts` is generated from `landr-api/supabase` (the
schema source of truth) via `npm run gen:types` (local Supabase stack must be
running). This widget talks to FastAPI, never Supabase directly — the
generated file is a compile-time-only anchor so hand-written wire types in
`src/api/types.ts` that mirror a native Postgres enum (e.g. `ProductKind`)
can derive from it instead of duplicating the literal union.

## Embedding

The widget is loaded by Para42's WordPress site via the shortcode `[landr_booking token="<widget_token>"]` (plugin lives in `wp-plugin/`). The token is the opaque, rotatable per-operator widget token (landr-il9f) issued from **Dashboard → Embed generator**; the API resolves the operator server-side so the slug never appears in the URL. Query params understood by the widget:

- `w` — opaque widget token (required; no token → generic landing page)
- `group` — optional product-category slug; scopes the embed to that category and all its sub-categories
- `product` — optional pre-selected product slug (wins over `group` when both are present). A single-product deep link ALWAYS renders that product; if it is sold out it shows a "Fully booked" state (no date picker, no Select CTA)
- `preview_token` — optional operator preview token; surfaces draft products during operator preview
- `show_sold_out` — optional; `true` (or `1`) makes the catalogue / category overview SHOW sold-out products as informational "Fully booked" cards (no Select CTA) instead of hiding them. Default off: sold-out products are hidden from the overview. (landr-7jgo)
- `variant` — optional visual direction: `aurora` (default, brand-gradient immersive), `summit` (editorial / image-forward), or `alpine` (crisp classic, dense). Token-level theming applied across the whole flow. (landr-d8rg.3)
- `preview` — optional; `1` (or `true`) enables a floating bottom-right **variant switcher** chip so a reviewer can flip aurora / summit / alpine live without editing the URL (it updates `?variant=` in place, no reload). A `preview_token` also enables the switcher. Customer-facing embeds omit both, so the switcher never ships to end users. (landr-d8rg.8)

## Repo layout

```
src/
  components/ui/   shadcn/ui primitives
  lib/utils.ts     cn() helper
  App.tsx          entry — customer flow lands in landr-e10.2
wp-plugin/         WordPress plugin (landr-e10.4)
```
