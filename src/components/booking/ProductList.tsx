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

interface Props {
  operatorSlug: string
  productGroup?: string
  preselectSlug?: string
  onSelect: (product: Product) => void
}

export function ProductList({ operatorSlug, productGroup, preselectSlug, onSelect }: Props) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locale = browserLocale()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listProducts(operatorSlug, { group: productGroup })
        if (cancelled) return
        setProducts(list)
        if (preselectSlug) {
          const match = list.find((p) => p.slug === preselectSlug)
          if (match) onSelect(match)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorSlug, productGroup, preselectSlug, onSelect])

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

  if (products.length === 0) {
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
      {products.map((product) => {
        const name = pickLocalized(product.name, product.name_localized, locale)
        const description = pickLocalized(
          product.short_description,
          product.short_description_localized,
          locale,
        )
        return (
          <Card key={product.product_id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{name}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            {product.description ? (
              <CardContent className="text-sm text-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:mb-2 [&_p]:leading-relaxed last:[&_p]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-primary [&_a]:underline">
                <ReactMarkdown>{product.description}</ReactMarkdown>
              </CardContent>
            ) : null}
            <CardContent className="mt-auto flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {product.duration_minutes
                  ? `${product.duration_minutes} min`
                  : product.product_kind === 'service'
                    ? (product.service_time_shape ?? 'service').replace('_', ' ')
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
