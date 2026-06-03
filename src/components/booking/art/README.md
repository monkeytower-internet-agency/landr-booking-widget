# Fallback art (landr-d8rg.3)

Designed SVG placeholders for categories/products with no uploaded photo. Brand-aware
(derives every colour from `var(--primary)` via opacity + blend layers, zero JS colour
math), deterministic from a slug seed (same seed ⇒ identical output). Bundled, no storage.

| Component     | Use                       | Icon placement |
| ------------- | ------------------------- | -------------- |
| `CategoryArt` | category/group tiles      | large, centred |
| `ProductArt`  | product cards / detail hero | small, corner  |

**Props** (both): `seed: string` (required slug), `aspect?: '4:3' \| '16:9' \| '1:1' \| '3:2'`
(default `'4:3'`), `title?: string` (a11y label; omit ⇒ decorative `aria-hidden`),
`className?: string` (size the `<svg>` via its wrapper). `ProductArt` also takes
`kind?: string` to bias icon keyword-matching by product name/type.

```tsx
<CategoryArt seed={group.slug} aspect="4:3" title={group.name} />
<ProductArt seed={product.slug} kind={product.name} aspect="16:9" title={product.name} />
```

Deterministic core lives in `artCore.ts` (`pickIcon`, `accentIndex`, `artRecipe`, `hashSeed`).
Icons: paraglider · mountain · compass · suitcase · backpack · gift (keyword-matched, hash fallback).
