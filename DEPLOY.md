# Deploy — Firebase Hosting (primary) + Cloudflare Pages (standby)

**Why two hosts (landr-3a8mh):** Spanish ISPs (Movistar, Vodafone, Orange, DIGI, MásMóvil)
null-route shared Cloudflare IPs during LaLiga matches by court order, so `bw.landr.de` on
Cloudflare times out for operators and customers in Spain (Canaries included) on match days.
Google's ranges have never been blocked (hayahora.futbol tracker). Every push to `dev` /
`staging` / `main` therefore deploys to:

| Tier | Firebase site (project `landr-de`) | CF Pages project (standby) |
| :-- | :-- | :-- |
| prod | `landr-bw` | `landr-booking-widget` |
| staging | `landr-bw-staging` | `landr-booking-widget-staging` |
| dev | `landr-bw-dev` | `landr-booking-widget-dev` |

`bw*.landr.de` DNS points at whichever host is primary (Firebase: DNS-only A record, grey cloud).
**Rollback** = point the record back at `<project>.pages.dev` (proxied CNAME); both hosts always
carry the same build. The Firebase step authenticates with WIF (SA `bw-deploy-<tier>@landr-de`)
(own WIF pool `github-widget`, never the landr-api `github` pool) and is gated on the repo variable `FIREBASE_HOSTING_ENABLED == 'true'`; provisioning lives in
the meta-repo `scripts/bw-firebase-provision.sh`.

Off Cloudflare the Pages Functions don't run: `/geo` falls through to the browser-timezone
guess (`src/lib/guessCountry.ts`), and the edge-baked splash logo (`functions/_middleware.ts`)
falls back to the cached-logo path in `src/lib/bootSplash.ts`.

## Cloudflare Pages (standby)

The widget deploys to Cloudflare Pages via `.github/workflows/deploy.yml`. The workflow:

1. Runs typecheck, lint, tests, and `npm run build`
2. Publishes `dist/` to the Cloudflare Pages project `landr-booking-widget`
3. On `push` to `main` → production; otherwise → preview branch

## One-time setup

### 1. Cloudflare Pages project

Create the project (any non-empty directory is fine for the bootstrap):

```bash
# from a directory with a tiny dist/ (or empty git init)
npx wrangler@latest pages project create landr-booking-widget \
  --production-branch=main
```

### 2. GitHub secrets

The workflow needs two repo secrets:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo monkeytower-internet-agency/landr-booking-widget --body "<token>"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo monkeytower-internet-agency/landr-booking-widget --body "<account-id>"
```

The token needs `Cloudflare Pages: Edit` scope on the account.

### 3. Repository variables (optional)

The workflow has sensible defaults, but you can override the build-time env via repo variables:

```bash
gh variable set VITE_API_BASE_URL --repo monkeytower-internet-agency/landr-booking-widget --body "https://api.landr.de"
```

### 4. Custom domain `bw.landr.de`

DNS is managed in DALM (Ansible/Tofu). The CNAME from `bw.landr.de` → `<project>.pages.dev` is filed under [the relevant DALM playbook ticket](../.beads). Until that's deployed, the project is reachable at `https://landr-booking-widget.pages.dev/?w=<widget_token>` (grab a token from Dashboard → Embed generator; without one the widget shows its generic landing page).

## Verifying a deploy

```bash
gh run watch --repo monkeytower-internet-agency/landr-booking-widget
# Then (use a real widget token from Dashboard → Embed generator):
open "https://bw.landr.de/?w=<widget_token>"
# Or, before DNS:
open "https://landr-booking-widget.pages.dev/?w=<widget_token>"
```
