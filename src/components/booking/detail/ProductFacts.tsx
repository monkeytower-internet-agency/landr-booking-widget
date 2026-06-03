/**
 * landr-d8rg.7: facts row for the product-detail page — a horizontal set
 * of icon chips conveying the at-a-glance shape of the product (duration,
 * hotel offering, pickup, kind). The conditional logic lives in the pure
 * sibling `productFacts.ts` (deriveProductFacts); this component is purely
 * presentational so the component file stays component-only.
 */
import { Clock, BedDouble, MapPin, Tag, type LucideIcon } from 'lucide-react'
import type { Product } from '@/api/types'
import { deriveProductFacts, type FactIcon } from './productFacts'

const ICONS: Record<FactIcon, LucideIcon> = {
  duration: Clock,
  hotel: BedDouble,
  pickup: MapPin,
  kind: Tag,
}

export function ProductFacts({ product }: { product: Product }) {
  const facts = deriveProductFacts(product)
  if (facts.length === 0) return null

  return (
    <ul
      className="flex flex-wrap gap-2"
      data-testid="product-facts"
      aria-label="Product details"
    >
      {facts.map((fact) => {
        const Icon = ICONS[fact.icon]
        return (
          <li
            key={`${fact.icon}-${fact.label}`}
            data-testid="product-fact"
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{fact.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
