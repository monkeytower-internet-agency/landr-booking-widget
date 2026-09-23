/**
 * landr-d8rg.7: facts row for the product-detail page — a horizontal set
 * of icon chips conveying the at-a-glance shape of the product (duration,
 * hotel offering, pickup, kind, guide languages — landr-pv2r1). The conditional logic lives in the pure
 * sibling `productFacts.ts` (deriveProductFacts); this component is purely
 * presentational so the component file stays component-only.
 */
import { Clock, BedDouble, MapPin, Tag, Languages, type LucideIcon } from 'lucide-react'
import type { Product } from '@/api/types'
import { tr } from '@/lib/strings'
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
      aria-label={tr('productDetailsAria', locale)}
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
                ? `${tr('offeredInPrefix', locale)} ${joinLanguageNames(languages)}`
                : undefined
            }
            className={cn(
              'inline-flex items-center gap-1.5 bg-muted px-3 py-1 text-sm text-muted-foreground',
              // landr-pv2r1 (E4): the languages fact can wrap onto several
              // lines at 360px; a fully rounded pill turns into a lozenge
              // there, so a `rounded-full` variant drops to `rounded-lg` for
              // this fact (alpine's square radius is kept as-is).
              languages.length > 0 && tokens.chipRadius === 'rounded-full'
                ? 'rounded-lg'
                : tokens.chipRadius,
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {languages.length > 0 ? (
              // landr-pv2r1 (E4): at phone width the list wraps. Each language
              // is a nowrap unit so a flag never ends one line with its name
              // on the next; the separator dot sits outside the units so the
              // wrap happens between languages.
              <span
                data-testid="product-fact-languages"
                className="flex min-w-0 flex-wrap items-center gap-x-1.5"
              >
                {languages.map((code, i) => (
                  <span key={code} className="inline-flex items-center gap-x-1.5">
                    {i > 0 ? <span aria-hidden>{' · '}</span> : null}
                    <span data-testid="product-fact-language" className="whitespace-nowrap">
                      <span aria-hidden>{languageFlag(code)}</span> {languageName(code)}
                    </span>
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
