# Deploy — Cloudflare Pages

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
gh variable set VITE_API_BASE_URL --repo monkeytower-internet-agency/landr-booking-widget --body "https://api.landr.app"
gh variable set VITE_DEFAULT_OPERATOR_SLUG --repo monkeytower-internet-agency/landr-booking-widget --body "para42"
```

### 4. Custom domain `book.landr.app`

DNS is managed in DALM (Ansible/Tofu). The CNAME from `book.landr.app` → `<project>.pages.dev` is filed under [the relevant DALM playbook ticket](../.beads). Until that's deployed, the project is reachable at `https://landr-booking-widget.pages.dev/?operator=para42`.

## Verifying a deploy

```bash
gh run watch --repo monkeytower-internet-agency/landr-booking-widget
# Then:
open "https://book.landr.app/?operator=para42"
# Or, before DNS:
open "https://landr-booking-widget.pages.dev/?operator=para42"
```
