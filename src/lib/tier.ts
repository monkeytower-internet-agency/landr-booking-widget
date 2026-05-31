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
