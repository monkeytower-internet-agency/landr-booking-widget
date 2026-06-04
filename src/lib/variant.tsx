/**
 * landr-d8rg.3 / landr-d8rg.8: VariantProvider — the React context provider for
 * the three visual variants. This file holds ONLY the provider component; the
 * context object, the useVariant hook, the tokens, types and pure helpers all
 * live in the sibling `variant.ts`, so the react-refresh/only-export-components
 * CI gate (which forbids a component file from also exporting non-components)
 * is happy.
 *
 * App wires this at the root, passing the `value` it derives once at boot via
 * `variantFromLocation()` plus whether preview is enabled
 * (`previewEnabledFromLocation()`). landr-d8rg.8 makes the provider STATEFUL:
 * the seed `value` becomes the initial active variant, and the floating
 * preview switcher flips it live via the context's `setVariant` (which also
 * writes the `?variant=` URL param). The rest of the widget still just consumes
 * `useVariant()`.
 */

import { useState, type ReactNode } from 'react'
import {
  VariantContext,
  VARIANT_TOKENS,
  writeVariantToUrl,
  type Variant,
} from './variant'

/**
 * Provider — App passes the resolved seed `value` (see variantFromLocation())
 * and `previewEnabled` (see previewEnabledFromLocation()). The provider holds
 * the active variant in state so the preview switcher can flip it live;
 * setVariant also mirrors the choice into the URL `?variant=` param (no
 * reload) so a refresh / shared link keeps the picked direction.
 *
 * previewEnabled defaults to false, so existing callers / tests that only pass
 * `value` keep the customer-facing behaviour (no live switcher).
 */
export function VariantProvider({
  value,
  previewEnabled = false,
  children,
}: {
  value: Variant
  previewEnabled?: boolean
  children: ReactNode
}) {
  const [variant, setVariantState] = useState<Variant>(value)

  const setVariant = (next: Variant) => {
    setVariantState(next)
    writeVariantToUrl(next)
  }

  return (
    <VariantContext.Provider
      value={{
        variant,
        tokens: VARIANT_TOKENS[variant],
        setVariant,
        previewEnabled,
      }}
    >
      {children}
    </VariantContext.Provider>
  )
}
