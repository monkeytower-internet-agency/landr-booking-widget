import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { listProducts } from '@/api/client'
import type { Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { showDateModelDetail } from '@/lib/tier'
import { isBookable } from '@/components/booking/bookability'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'

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
  const locale = browserLocale()

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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading…</CardTitle>
        </CardHeader>
      </Card>
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
          <CardTitle>No products available right now.</CardTitle>
          <CardDescription>Please check back later.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((product) => {
        const name = pickLocalized(product.name, product.name_localized, locale)
        const description = pickLocalized(
          product.short_description,
          product.short_description_localized,
          locale,
        )

        // landr-7jgo: sold-out card — informational only, no picker / CTA.
        // Only reachable here when showSoldOut is true (soldOut is empty
        // otherwise), so we never hide a bookable product behind this branch.
        if (!isBookable(product)) {
          return (
            <FullyBookedNotice
              key={product.product_id}
              name={name}
              description={description || null}
              compact
            />
          )
        }

        const isDraft = product.is_publicly_listed === false
        return (
          <Card key={product.product_id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{name}</CardTitle>
                {/*
                  landr-7zc5.3: Draft badge — visible only in preview mode
                  (is_publicly_listed=false means the operator hasn't
                  published this product yet). Customers never see this
                  because live embeds never have a preview_token in the URL
                  and the API never returns drafts without one.
                */}
                {isDraft ? (
                  <span
                    className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                    data-testid="draft-badge"
                  >
                    Draft — preview
                  </span>
                ) : null}
              </div>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            {product.description ? (
              <CardContent className="text-sm text-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:mb-2 [&_p]:leading-relaxed last:[&_p]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-primary [&_a]:underline">
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </CardContent>
            ) : null}
            <CardContent className="mt-auto flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {/*
                  landr-7jgo: the per-product DATE-MODEL detail (single date /
                  days range / fixed window) is an operator-facing config aid,
                  shown only in dev + staging. In production this chip falls
                  back to duration (or the product kind) so customers never see
                  the internal scheduling-shape vocabulary.
                */}
                {product.duration_minutes
                  ? `${product.duration_minutes} min`
                  : product.product_kind === 'service'
                    ? showDateModelDetail()
                      ? (product.service_time_shape ?? 'service').replace('_', ' ')
                      : 'service'
                    : product.product_kind.replace('_', ' ')}
              </span>
              <Button type="button" onClick={() => onSelect(product)}>
                Select
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
