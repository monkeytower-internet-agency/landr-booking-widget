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

## TypeScript strict mode

`tsconfig.app.json` sets `"strict": true`, so `npm run typecheck` (`tsc -b`) is the
strict gate; there is no separate ratchet or baseline file.

## Types

`src/types/database.gen.ts` is generated from `landr-api/supabase` (the
schema source of truth) via `npm run gen:types` (local Supabase stack must be
running). This widget talks to FastAPI, never Supabase directly — the
generated file is a compile-time-only anchor so hand-written wire types in
`src/api/types.ts` that mirror a native Postgres enum (e.g. `ProductKind`)
can derive from it instead of duplicating the literal union.

`src/types/api.gen.ts` (landr-y3oj.2) is generated via `npm run gen:api-types`
from `contracts/openapi.json`, a committed copy of `landr-api`'s
`openapi.json` (its own schema-source-of-truth dump). See `landr-api`'s
README "Contracts codegen" section for the full regen loop across all repos
(`landr-api/scripts/regen-contracts.sh`) and how CI drift-checks it. PR CI
re-runs `gen:api-types` against the committed `contracts/openapi.json` and
fails on diff — full call-site adoption rides landr-y3oj.3.

## Embedding

The widget is loaded by Para42's WordPress site via the shortcode `[landr_booking token="<widget_token>"]` (plugin lives in `wp-plugin/`). The token is the opaque, rotatable per-operator widget token (landr-il9f) issued from **Dashboard → Embed generator**; the API resolves the operator server-side so the slug never appears in the URL. Query params understood by the widget:

- `w` — opaque widget token (required; no token → generic landing page)
- `group` — optional product-category slug; scopes the embed to that category and all its sub-categories
- `product` — optional pre-selected product slug (wins over `group` when both are present). A single-product deep link ALWAYS renders that product; if it is sold out it shows a "Fully booked" state (no date picker, no Select CTA)
- `start` — optional; `dates` opens a single-product embed (`product=` required, ignored otherwise) straight on the date picker. The product-detail (Overview) step is skipped and nothing links back to it — for host pages that already describe the product. A sold-out product still shows "Fully booked". (landr-6eita.1)
- `preview_token` — optional operator preview token; surfaces draft products during operator preview
- `show_sold_out` — optional; `true` (or `1`) makes the catalogue / category overview SHOW sold-out products as informational "Fully booked" cards (no Select CTA) instead of hiding them. Default off: sold-out products are hidden from the overview. (landr-7jgo)
- `variant` — optional visual direction: `aurora` (default, brand-gradient immersive), `summit` (editorial / image-forward), or `alpine` (crisp classic, dense). Token-level theming applied across the whole flow. (landr-d8rg.3)
- `preview` — optional; `1` (or `true`) enables a floating bottom-right **variant switcher** chip so a reviewer can flip aurora / summit / alpine live without editing the URL (it updates `?variant=` in place, no reload). A `preview_token` also enables the switcher. Customer-facing embeds omit both, so the switcher never ships to end users. (landr-d8rg.8)

**Auto-height (landr-6eita.1).** When embedded (`window.parent !== window`) the widget posts `{ type: 'landr:resize', height }` (integer CSS px of its content, target `'*'`) to the parent whenever its height changes, so the host can size the iframe instead of the widget scrolling inside it. The parent must accept it only from its own landr iframe (`event.source`) and that iframe's `src` origin (`event.origin`); the WP plugin and the dashboard embed snippet do this. Implementation: `src/lib/autoHeight.ts`.

## Repo layout

```
src/
  components/ui/   shadcn/ui primitives
  lib/utils.ts     cn() helper
  App.tsx          entry — customer flow lands in landr-e10.2
wp-plugin/         WordPress plugin (landr-e10.4)
```

## Languages (landr-5aih0.9, landr-8r6oc.4)

Widget chrome (buttons, headings, validation messages, date-picker help — every
string that isn't operator-authored content) is bundled: English and German in
`src/lib/strings.ts`, Spanish and Turkish as catalogs under `src/lib/locales/`.
`pickBundle(locale)` / `tr(key, locale)` resolve `de*`, `es*` and `tr*` locales to
their bundle and everything else to English; there is no i18n library — the
bundles are the whole translation layer, following the pattern landr-ifcu
established for the (then English-only) widget.

- **Locale source**: the resolver in `src/lib/locale.ts` (`browserLocale()`) —
  an invite's own `language` override, else the operator's `customer_languages`
  whitelist (falling back to `default_locale`), else the raw browser locale.
  Components call `browserLocale()` directly (no prop threading) and pass the
  result into `tr()`/`pickBundle()`.
- **Adding a locale**: a further language is a drop-in catalog. Create
  `src/lib/locales/<code>.ts` exporting a full `Bundle` (the type makes a missing
  key a compile error; copy `es.ts` as a starting point and keep every
  `{placeholder}`), then add it to `BUNDLES` in `src/lib/strings.ts`. Also give it
  entries in the small per-language tables: `participantLanguages.ts`
  (`LANGUAGE_NAMES_BY_UI`), `cancelStrings.ts` / `approvalReplyStrings.ts` (the
  email-language pages), `ShopComingSoonStub.tsx`, `detail/productFacts.ts`, and
  `ui/calendar.tsx` (react-day-picker locale). `locales/catalogs.test.ts` checks
  key and placeholder parity for every registered language.
  Turkish and Spanish are machine translations awaiting a native-speaker review.
- **Dates**: `src/components/booking/dateLabel.ts` formats every date/time
  label via `Intl.DateTimeFormat`, threaded the resolved locale through; the calendar's
  month and weekday names use react-day-picker's `locale` catalogs for the same
  languages. Plurals are bundle-driven: each count word has a singular and a
  plural field (equal in Turkish, which keeps the noun singular after a number).
  Currency goes through `Intl.NumberFormat` in `priceSidebarHelpers.ts`
  (`formatMoney`) and `accommodationCalc.ts` (`formatCurrency`), same pattern.
- **Page-scoped exception**: `ApprovalReplyPage` (the hotel rooms-request
  reply page) ships its own de/en/es bundle in `approvalReplyStrings.ts`
  under a *different* locale rule — it follows the hotel's language (the
  email it was sent in), not the customer's — predating this ticket
  (landr-em0r.9) and left as-is.
- **Regression guard**: `src/components/booking/noEnglishLiteral.test.ts`
  scans the component tree for un-translated English chrome text. A handful
  of surfaces are deliberately still English-only (staff-only UI, a few
  drag-and-drop screen-reader announcements, an invite-only sub-flow) — see
  that test's file header and its `ALLOWED_LITERALS` map for the exact list
  and why.
- **Operator-authored content is untouched**: product/category names,
  custom-form field labels, stage labels, and after-booking HTML are always
  operator-supplied over the wire (localized server-side / via
  `pickLocalized`) — never hard-coded widget copy, so they never need an
  entry in the bundle.
