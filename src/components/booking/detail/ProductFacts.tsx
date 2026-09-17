/**
 * landr-d8rg.7: facts row for the product-detail page — a horizontal set
 * of icon chips conveying the at-a-glance shape of the product (duration,
 * hotel offering, pickup, kind, guide languages — landr-pv2r1). The conditional logic lives in the pure
 * sibling `productFacts.ts` (deriveProductFacts); this component is purely
 * presentational so the component file stays component-only.
 */
import { Clock, BedDouble, MapPin, Tag, Languages, type LucideIcon } from 'lucide-react'
import type { Product } from '@/api/types'
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'
import { joinLanguageNames, languageFlag, languageName } from '../participantLanguages'
import { deriveProductFacts, type FactIcon } from './productFacts'

const ICONS: Record<FactIcon, LucideIcon> = {
  duration: Clock,
  hotel: BedDouble,
  pickup: MapPin,
  kind: Tag,
  languages: Languages,
}

export function ProductFacts({ product, locale }: { product: Product; locale: string }) {
  // landr-d8rg.8: fact chips track the variant chip radius (alpine squares
  // them) so the detail surface matches the browse cards' chip language.
  const { tokens } = useVariant()
  const facts = deriveProductFacts(product, locale)
  if (facts.length === 0) return null

  return (
    <ul
      className="flex flex-wrap gap-2"
      data-testid="product-facts"
      aria-label="Product details"
    >
      {facts.map((fact) => {
        const Icon = ICONS[fact.icon]
        const languages = fact.languages ?? []
        return (
          <li
            key={`${fact.icon}-${fact.label}`}
            data-testid="product-fact"
            // landr-pv2r1 (E4): flags are decorative, so the languages fact
            // announces itself as one natural sentence instead.
            aria-label={
              languages.length > 0
                ? `Offered in ${joinLanguageNames(languages)}`
                : undefined
            }
            className={cn(
              'inline-flex items-center gap-1.5 bg-muted px-3 py-1 text-sm text-muted-foreground',
              tokens.chipRadius,
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {languages.length > 0 ? (
              <span data-testid="product-fact-languages">
                {languages.map((code, i) => (
                  <span key={code}>
                    {i > 0 ? ' · ' : null}
                    <span aria-hidden>{languageFlag(code)}</span> {languageName(code)}
                  </span>
                ))}
              </span>
            ) : (
              <span>{fact.label}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
