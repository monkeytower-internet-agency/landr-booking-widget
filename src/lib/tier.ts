/**
 * landr-7dya.20: Deploy-tier helper.
 *
 * VITE_DEPLOY_TIER is injected per branch in .github/workflows/deploy.yml:
 *   dev branch     → 'dev'
 *   staging branch → 'staging'
 *   main branch    → 'prod'
 *
 * Any other value (typos, undefined) maps to undefined so the TierBadge
 * renders nothing — the production path is always silent.
 */

export type DeployTier = 'dev' | 'staging' | 'prod'

/** Returns the validated deploy tier, or undefined for prod / unset. */
export function getTier(): DeployTier | undefined {
  const raw = import.meta.env['VITE_DEPLOY_TIER']
  if (raw === 'dev' || raw === 'staging' || raw === 'prod') return raw
  return undefined
}

/**
 * landr-7jgo: whether the per-product DATE-MODEL detail (the
 * "single date / days range / fixed window" chip) is shown.
 *
 * It is an internal debugging aid for operators/staff while configuring a
 * catalogue, NOT customer-facing polish — so we keep it in dev + staging and
 * HIDE it in production. Reuses the same VITE_DEPLOY_TIER gate the TierBadge
 * uses (injected per branch by deploy.yml) rather than import.meta.env.PROD,
 * so the badge correctly survives in staging (where PROD would be true).
 *
 * prod / unset → false (hidden); dev / staging → true (shown).
 */
export function showDateModelDetail(): boolean {
  const tier = getTier()
  return tier === 'dev' || tier === 'staging'
}
