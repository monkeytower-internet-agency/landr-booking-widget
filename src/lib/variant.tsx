/**
 * landr-d8rg.3: VariantProvider — the React context provider for the three
 * visual variants. This file holds ONLY the provider component; the context
 * object, the useVariant hook, the tokens, types and pure helpers all live in
 * the sibling `variant.ts`, so the react-refresh/only-export-components CI gate
 * (which forbids a component file from also exporting non-components) is happy.
 *
 * App wires this at the root, passing an explicit `value` it derives once at
 * boot via `variantFromLocation()` — keeping URL-reading out of the render tree
 * so the rest of the widget just consumes `useVariant()`.
 */

import type { ReactNode } from 'react'
import { VariantContext, VARIANT_TOKENS, type Variant } from './variant'

/**
 * Provider — App passes the resolved `value` explicitly (see
 * variantFromLocation()) so this component never reads the URL itself.
 */
export function VariantProvider({
  value,
  children,
}: {
  value: Variant
  children: ReactNode
}) {
  return (
    <VariantContext.Provider value={{ variant: value, tokens: VARIANT_TOKENS[value] }}>
      {children}
    </VariantContext.Provider>
  )
}
