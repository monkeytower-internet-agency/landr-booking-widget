import { useEffect, useState } from 'react'
import { listProducts } from '@/api/client'
import type { Product } from '@/api/types'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { showDateModelDetail } from '@/lib/tier'
import { isBookable } from '@/components/booking/bookability'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { ProductCard } from '@/components/booking/browse/ProductCard'
import { ProductRow } from '@/components/booking/browse/ProductRow'
import { ProductSkeleton } from '@/components/booking/browse/ProductSkeleton'
import { ViewToggle } from '@/components/booking/browse/ViewToggle'
import { useViewMode } from '@/components/booking/browse/useViewMode'

interface Props {
  operatorToken: string
  /**
   * landr-7zc5.3: operator preview token. When present the products
   * fetch requests the preview path so draft products are included.
   * Absent in all normal customer-facing embed URLs.
   */
  previewToken?: string
  productGroup?: string
  preselectSlug?: string
  /**
   * landr-7jgo: when true, sold-out (non-bookable) products are SHOWN in the
   * catalogue overview as informational "Fully booked" cards (no Select CTA)
   * rather than hidden. Default false: sold-out products are hidden entirely.
   * Driven by the embed's `show_sold_out=true` param so an operator can opt a
   * given embed into showing them.
   */
  showSoldOut?: boolean
  onSelect: (product: Product) => void
  /**
   * landr-7jgo: a single-product deep link (?product=<slug>) that resolved to
   * a SOLD-OUT product. We never auto-select it (there's nothing to pick), and
   * we never silently drop it either — the deep-linked product is ALWAYS
   * rendered, just as "Fully booked". App handles that standalone state.
   */
  onPreselectSoldOut?: (product: Product) => void
}

export function ProductList({
  operatorToken,
  previewToken,
  productGroup,
  preselectSlug,
  showSoldOut = false,
  onSelect,
  onPreselectSoldOut,
}: Props) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useViewMode()
  const locale = browserLocale()
  const showDateModel = showDateModelDetail()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listProducts(operatorToken, {
          group: productGroup,
          previewToken,
        })
        if (cancelled) return
        setProducts(list)
        if (preselectSlug) {
          const match = list.find((p) => p.slug === preselectSlug)
          if (match) {
            // landr-7jgo: a deep link ALWAYS surfaces its product. When it's
            // bookable we drop straight into the picker (existing behaviour);
            // when it's sold out we hand it to App's "Fully booked" state
            // instead of auto-selecting into a picker with no dates.
            if (isBookable(match)) {
              onSelect(match)
            } else {
              onPreselectSoldOut?.(match)
            }
          }
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    operatorToken,
    previewToken,
    productGroup,
    preselectSlug,
    onSelect,
    onPreselectSoldOut,
  ])

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
    // Skeletons matching the active layout while the (unchanged) fetch runs.
    return (
      <div className="flex flex-col gap-4">
        <span className="sr-only" role="status">
          Loading products…
        </span>
        <ProductSkeleton view={view} />
      </div>
    )
  }

  // landr-7jgo: split bookable vs sold-out. Bookable products always show.
  // Sold-out products are HIDDEN by default and only rendered (as "Fully
  // booked" cards, no CTA) when the embed opted in via show_sold_out=true.
  const bookable = products.filter((p) => isBookable(p))
  const soldOut = showSoldOut ? products.filter((p) => !isBookable(p)) : []
  const visible = [...bookable, ...soldOut]

  if (visible.length === 0) {
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div
        className={
          view === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'flex flex-col gap-3'
        }
        data-testid={`product-${view}`}
      >
        {visible.map((product) => {
          // landr-7jgo: sold-out card — informational only, no picker / CTA.
          // Only reachable here when showSoldOut is true (soldOut is empty
          // otherwise), so we never hide a bookable product behind this branch.
          // Reused in BOTH layouts so the "Fully booked" contract (badge, no
          // Select) holds whether the catalogue is in grid or list view.
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

          return view === 'grid' ? (
            <ProductCard
              key={product.product_id}
              product={product}
              locale={locale}
              showDateModel={showDateModel}
              onSelect={onSelect}
            />
          ) : (
            <ProductRow
              key={product.product_id}
              product={product}
              locale={locale}
              showDateModel={showDateModel}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    </div>
  )
}
