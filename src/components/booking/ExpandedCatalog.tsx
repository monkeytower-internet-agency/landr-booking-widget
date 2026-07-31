/**
 * landr-4a5j: expanded catalog — operator-configurable alternative to the
 * category-tile entrance (CategoryStep). Instead of drilling into a category
 * to see its products, the first step lists ALL products grouped under
 * category headers ("Guiding → Guided paragliding day, Tandem intro flight",
 * "Travels → Denmark paragliding trip [date chips]", …) so the customer
 * picks a product directly.
 *
 * Selected via ?catalog=expanded / operatorSettings.widget_catalog_layout —
 * App.tsx renders this INSTEAD of CategoryStep when in expanded mode, on the
 * same 'pick-category' step (mode: 'expanded'); it never changes the step
 * machine's shape, so back-nav / breadcrumb / sidebar logic in
 * appStepMachine.ts needs no changes.
 *
 * Data: ONE unscoped listProducts(token) call (no per-group N+1 — Product
 * already carries group_slug/group_name, so grouping happens client-side).
 * `groups` is the SAME array App already fetched for CategoryStep (via
 * listProductGroups at boot) — passed in rather than re-fetched. Per-product
 * fixed-date windows (the full chip row, same data as the "Dates" tab) are
 * fetched by FixedDateWindowChips itself, gated on next_window_start/end
 * being present — bounded to only the fixed_window products with an
 * upcoming date, not every product in the catalogue.
 *
 * REUSES ProductCard/ProductRow (browse/) for the actual product tile so the
 * expanded layout stays visually consistent with the scoped list, and the
 * bookable/sold-out split from ProductList.tsx (bookable always shown;
 * sold-out shown as informational FullyBookedNotice cards only when
 * showSoldOut is true, split within each category section).
 */
import { useEffect, useState } from 'react'
import { explainFetchError, listProducts } from '@/api/client'
import type { Product, ProductGroup } from '@/api/types'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { showDateModelDetail } from '@/lib/tier'
import { isBookable } from '@/components/booking/bookability'
import { FixedDateWindowChips } from '@/components/booking/FixedDateWindowChips'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { ProductCard } from '@/components/booking/browse/ProductCard'
import { ProductRow } from '@/components/booking/browse/ProductRow'
import { ProductSkeleton } from '@/components/booking/browse/ProductSkeleton'
import { useViewMode } from '@/components/booking/browse/useViewMode'

interface Props {
  operatorToken: string
  /** landr-7zc5.3: operator preview token — includes drafts when present. */
  previewToken?: string
  /** The operator's product groups (already fetched by App at boot). */
  groups: ProductGroup[]
  /**
   * landr-7jgo: when true, sold-out products render as informational
   * "Fully booked" cards within their category section instead of being
   * hidden. Mirrors ProductList's showSoldOut contract exactly.
   */
  showSoldOut?: boolean
  /** Operator's expose_seats_to_customer flag — passed through to the
   * per-product date-window chips (mirrors FixedDateWindowPicker). */
  exposeSeats?: boolean
  onSelect: (product: Product) => void
}

/** A single group's products, split bookable-first then sold-out. */
function visibleForGroup(
  products: Product[],
  group: ProductGroup,
  showSoldOut: boolean,
): Product[] {
  const inGroup = products.filter((p) => p.group_slug === group.slug)
  const bookable = inGroup.filter((p) => isBookable(p))
  const soldOut = showSoldOut ? inGroup.filter((p) => !isBookable(p)) : []
  return [...bookable, ...soldOut]
}

export function ExpandedCatalog({
  operatorToken,
  previewToken,
  groups,
  showSoldOut = false,
  exposeSeats = true,
  onSelect,
}: Props) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view] = useViewMode()
  const locale = browserLocale()
  const showDateModel = showDateModelDetail()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Unscoped — Product already carries group_slug/group_name, so we
        // group client-side below instead of one fetch per category.
        const list = await listProducts(operatorToken, { previewToken })
        if (!cancelled) setProducts(list)
      } catch (err) {
        if (!cancelled) setError(explainFetchError(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorToken, previewToken])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We could not load the products.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!products) {
    return (
      <div className="flex flex-col gap-4" data-testid="expanded-catalog">
        <span className="sr-only" role="status">
          Loading products…
        </span>
        <ProductSkeleton view={view} />
      </div>
    )
  }

  // Non-empty = has at least one product to actually show, mirroring
  // CategoryStep's `product_count > 0` tile-hiding rule (product_count is
  // subtree-wide server-side; here we filter on the client's already-fetched
  // visible set so a group whose only products are sold-out — and
  // showSoldOut is off — is hidden exactly like an empty category tile).
  const sections = groups
    .map((group) => ({
      group,
      visible: visibleForGroup(products, group, showSoldOut),
    }))
    .filter((section) => section.visible.length > 0)

  if (sections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No products in this category.</CardTitle>
          <CardDescription>Please check back later.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8" data-testid="expanded-catalog">
      {sections.map(({ group, visible }) => {
        const groupName = pickLocalized(
          group.name,
          group.name_localized,
          locale,
        )
        return (
          <section key={group.id} data-testid={`catalog-section-${group.slug}`}>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {groupName}
            </h2>
            <div
              className={
                view === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2'
                  : 'flex flex-col gap-3'
              }
              data-testid={`catalog-section-products-${group.slug}`}
            >
              {visible.map((product) => {
                if (!isBookable(product)) {
                  const name = pickLocalized(
                    product.name,
                    product.name_localized,
                    locale,
                  )
                  const description =
                    pickLocalized(
                      product.short_description,
                      product.short_description_localized,
                      locale,
                    ) || null
                  return (
                    <FullyBookedNotice
                      key={product.product_id}
                      name={name}
                      description={description}
                      compact
                    />
                  )
                }

                const hasUpcomingWindow =
                  product.next_window_start && product.next_window_end

                return (
                  <div key={product.product_id} className="flex flex-col gap-1">
                    {view === 'grid' ? (
                      <ProductCard
                        product={product}
                        locale={locale}
                        showDateModel={showDateModel}
                        onSelect={onSelect}
                      />
                    ) : (
                      <ProductRow
                        product={product}
                        locale={locale}
                        showDateModel={showDateModel}
                        onSelect={onSelect}
                      />
                    )}
                    {hasUpcomingWindow ? (
                      <FixedDateWindowChips
                        productId={product.product_id}
                        slug={product.slug}
                        exposeSeats={exposeSeats}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
