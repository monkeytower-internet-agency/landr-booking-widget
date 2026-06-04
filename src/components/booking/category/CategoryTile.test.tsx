import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ProductGroup } from '@/api/types'
import { VariantProvider } from '@/lib/variant.tsx'
import { CategoryTile } from './CategoryTile'
import { TILE_HOVER_MAP, TILE_SCRIM_MAP } from '@/lib/tileStyle'

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id: 'g-1',
    slug: 'tandem',
    name: 'Tandem Flights',
    name_localized: { de: 'Tandemflüge' },
    description: 'English description.',
    description_localized: { de: 'Deutsche Beschreibung.' },
    image_url: null,
    sort_order: 10,
    parent_id: null,
    product_count: 4,
    ...overrides,
  }
}

describe('CategoryTile (landr-d8rg.5)', () => {
  it('localizes name + description via pickLocalized for the given locale', () => {
    render(<CategoryTile group={makeGroup()} locale="de-DE" onPick={vi.fn()} />)
    expect(screen.getByText('Tandemflüge')).toBeInTheDocument()
    expect(screen.getByText('Deutsche Beschreibung.')).toBeInTheDocument()
  })

  it('falls back to the base name/description when no localized value exists', () => {
    render(
      <CategoryTile
        group={makeGroup({ name_localized: null, description_localized: null })}
        locale="de-DE"
        onPick={vi.fn()}
      />,
    )
    expect(screen.getByText('Tandem Flights')).toBeInTheDocument()
    expect(screen.getByText('English description.')).toBeInTheDocument()
  })

  it('omits the description line entirely when there is no description', () => {
    render(
      <CategoryTile
        group={makeGroup({ description: null, description_localized: null })}
        locale="en"
        onPick={vi.fn()}
      />,
    )
    expect(screen.queryByText('English description.')).not.toBeInTheDocument()
    // name + count chip still render.
    expect(screen.getByText('Tandem Flights')).toBeInTheDocument()
    expect(screen.getByText('4 offers')).toBeInTheDocument()
  })

  it('renders the count chip', () => {
    render(<CategoryTile group={makeGroup({ product_count: 1 })} locale="en" onPick={vi.fn()} />)
    expect(screen.getByTestId('category-count-chip')).toHaveTextContent('1 offer')
  })

  it('produces a real, focusable <button>', () => {
    render(<CategoryTile group={makeGroup()} locale="en" onPick={vi.fn()} />)
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.tagName).toBe('BUTTON')
    expect(tile).toHaveAttribute('type', 'button')
  })

  it('aurora puts copy on top of the image (overlaid white text)', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile group={makeGroup({ image_url: 'https://x.test/c.jpg' })} locale="en" onPick={vi.fn()} />
      </VariantProvider>,
    )
    const heading = screen.getByText('Tandem Flights')
    // aurora overlays the copy on top of the image: the heading sits inside an
    // absolutely-positioned, white-text block.
    const overlay = heading.closest('.absolute')
    expect(overlay).not.toBeNull()
    expect(overlay?.className).toContain('text-white')
  })

  it('summit and alpine place copy in a normal flow block below the image (not overlaid)', () => {
    for (const variant of ['summit', 'alpine'] as const) {
      const { unmount } = render(
        <VariantProvider value={variant}>
          <CategoryTile group={makeGroup({ image_url: 'https://x.test/c.jpg' })} locale="en" onPick={vi.fn()} />
        </VariantProvider>,
      )
      const heading = screen.getByText('Tandem Flights')
      // No absolutely-positioned ancestor: the copy is in normal document flow
      // below the image, not overlaid on it.
      expect(heading.closest('.absolute')).toBeNull()
      unmount()
    }
  })

  it('renders an <img> cover when image_url is set and no SVG fallback', () => {
    const { container } = render(
      <CategoryTile group={makeGroup({ image_url: 'https://x.test/cover.jpg' })} locale="en" onPick={vi.fn()} />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://x.test/cover.jpg')
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(container.querySelector('svg')).toBeNull()
  })
})

// landr-jb1k.2: tile font and title case applied to the tile <h3>.
describe('CategoryTile font and case props (landr-jb1k.2)', () => {
  it('applies titleFontStyle as inline fontFamily on the h3', () => {
    render(
      <CategoryTile
        group={makeGroup({ name: 'Tandem Flights' })}
        locale="en"
        onPick={vi.fn()}
        titleFontStyle="'Playfair Display', Georgia, serif"
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.style.fontFamily).toContain('Playfair Display')
  })

  it('applies titleCaseClass as a class on the h3', () => {
    render(
      <CategoryTile
        group={makeGroup({ name: 'Tandem Flights' })}
        locale="en"
        onPick={vi.fn()}
        titleCaseClass="uppercase"
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.className).toContain('uppercase')
  })

  it('applies no inline style and no extra class when props are absent', () => {
    render(
      <CategoryTile
        group={makeGroup({ name: 'Tandem Flights' })}
        locale="en"
        onPick={vi.fn()}
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.style.fontFamily).toBe('')
    expect(h3.className).not.toContain('uppercase')
    expect(h3.className).not.toContain('lowercase')
    expect(h3.className).not.toContain('capitalize')
  })

  it('applies both font and case simultaneously', () => {
    render(
      <CategoryTile
        group={makeGroup({ name: 'Tandem Flights' })}
        locale="en"
        onPick={vi.fn()}
        titleFontStyle="'Caveat', cursive"
        titleCaseClass="capitalize"
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.style.fontFamily).toContain('Caveat')
    expect(h3.className).toContain('capitalize')
  })
})

// landr-jb1k.4: creative tile-style options (radius / aspect / scrim / hover).
// Each option OVERRIDES the variant token for tiles only; absent = current/auto
// behaviour so untouched embeds never shift.
describe('CategoryTile tile-style options (landr-jb1k.4)', () => {
  // --- radius: overrides the variant token corner radius on the button ---
  it('applies tileRadiusClass on the tile button, overriding the variant radius', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup()}
          locale="en"
          onPick={vi.fn()}
          tileRadiusClass="rounded-3xl"
        />
      </VariantProvider>,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('rounded-3xl')
    // The aurora variant default radius (rounded-2xl) must be gone — overridden.
    expect(tile.className).not.toContain('rounded-2xl')
  })

  it('keeps the variant token radius when tileRadiusClass is absent (null = unchanged)', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile group={makeGroup()} locale="en" onPick={vi.fn()} />
      </VariantProvider>,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('rounded-2xl') // aurora default
  })

  // --- aspect: overrides the variant token aspect on the media frame ---
  it('applies tileAspectClass on the media frame, overriding the variant aspect', () => {
    const { container } = render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
          locale="en"
          onPick={vi.fn()}
          tileAspectClass="aspect-video"
        />
      </VariantProvider>,
    )
    const frame = container.querySelector('img')?.parentElement
    expect(frame?.className).toContain('aspect-video')
    // aurora default tileAspect (aspect-[4/3]) is overridden.
    expect(frame?.className).not.toContain('aspect-[4/3]')
  })

  it('keeps the variant token aspect when tileAspectClass is absent', () => {
    const { container } = render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
          locale="en"
          onPick={vi.fn()}
        />
      </VariantProvider>,
    )
    const frame = container.querySelector('img')?.parentElement
    expect(frame?.className).toContain('aspect-[4/3]') // aurora default
  })

  // --- hover: split between button (lift) and image (zoom) ---
  it("hover='lift' lifts the button (translate) and does NOT scale the image", () => {
    const { container } = render(
      <CategoryTile
        group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
        locale="en"
        onPick={vi.fn()}
        tileHover={TILE_HOVER_MAP.lift}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('hover:-translate-y-0.5')
    const img = container.querySelector('img')
    expect(img?.className).not.toContain('group-hover:scale-105')
  })

  it("hover='zoom' scales the image and does NOT lift the button", () => {
    const { container } = render(
      <CategoryTile
        group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
        locale="en"
        onPick={vi.fn()}
        tileHover={TILE_HOVER_MAP.zoom}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).not.toContain('hover:-translate-y-0.5')
    const img = container.querySelector('img')
    expect(img?.className).toContain('group-hover:scale-105')
  })

  it("hover='none' neither lifts the button nor scales the image", () => {
    const { container } = render(
      <CategoryTile
        group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
        locale="en"
        onPick={vi.fn()}
        tileHover={TILE_HOVER_MAP.none}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).not.toContain('hover:-translate-y-0.5')
    const img = container.querySelector('img')
    expect(img?.className).not.toContain('group-hover:scale-105')
  })

  it('defaults to the lift hover when tileHover is absent (null = unchanged)', () => {
    render(<CategoryTile group={makeGroup()} locale="en" onPick={vi.fn()} />)
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('hover:-translate-y-0.5')
  })

  // --- scrim: aurora-only; light flips title text to dark (AA) ---
  it('aurora applies the brand scrim overlay and keeps white title text', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
          locale="en"
          onPick={vi.fn()}
          tileScrim={TILE_SCRIM_MAP.brand}
        />
      </VariantProvider>,
    )
    const scrim = screen.getByTestId('category-scrim')
    expect(scrim.className).toContain('from-primary/80')
    const overlay = screen.getByText('Tandem Flights').closest('.absolute')
    expect(overlay?.className).toContain('text-white')
  })

  it("aurora 'light' scrim uses a white gradient AND flips title text to dark (AA)", () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
          locale="en"
          onPick={vi.fn()}
          tileScrim={TILE_SCRIM_MAP.light}
        />
      </VariantProvider>,
    )
    const scrim = screen.getByTestId('category-scrim')
    expect(scrim.className).toContain('from-white/85')
    const overlay = screen.getByText('Tandem Flights').closest('.absolute')
    // Dark title text container — NOT white — so white-on-white never happens.
    expect(overlay?.className).toContain('text-foreground')
    expect(overlay?.className).not.toContain('text-white')
  })

  it('aurora keeps the variant token (black) scrim with white text when tileScrim is absent', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryTile
          group={makeGroup({ image_url: 'https://x.test/c.jpg' })}
          locale="en"
          onPick={vi.fn()}
        />
      </VariantProvider>,
    )
    const scrim = screen.getByTestId('category-scrim')
    // aurora token overlayScrim is the black AA gradient.
    expect(scrim.className).toContain('from-black/70')
    const overlay = screen.getByText('Tandem Flights').closest('.absolute')
    expect(overlay?.className).toContain('text-white')
  })
})
