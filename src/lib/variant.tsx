/**
 * landr-d8rg.3 / landr-jb1k.2: VariantProvider — the React context provider for
 * the three visual variants. This file holds ONLY the provider component; the
 * context object, the useVariant hook, the tokens, types and pure helpers all
 * live in the sibling `variant.ts`, so the react-refresh/only-export-components
 * CI gate (which forbids a component file from also exporting non-components)
 * is happy.
 *
 * App wires this at the root, passing the `value` it derives once at boot via
 * `variantFromLocation()`. The provider is STATEFUL: the seed `value` becomes
 * the initial active variant, and App's operator-settings effect calls the
 * context's `setVariant` once the operator's real widget_variant resolves
 * (async, after `value` was already seeded). The rest of the widget just
 * consumes `useVariant()`.
 */

import { useState, type ReactNode } from 'react'
import { VariantContext, VARIANT_TOKENS, type Variant } from './variant'

/**
 * Provider — App passes the resolved seed `value` (see variantFromLocation()).
 * The provider holds the active variant in state so App's operator-settings
 * effect can update it once the async fetch resolves.
 */
export function VariantProvider({
  value,
  children,
}: {
  value: Variant
  children: ReactNode
}) {
  const [variant, setVariant] = useState<Variant>(value)

  return (
    <VariantContext.Provider
      value={{
        variant,
        tokens: VARIANT_TOKENS[variant],
        setVariant,
      }}
    >
      {children}
    </VariantContext.Provider>
  )
}
