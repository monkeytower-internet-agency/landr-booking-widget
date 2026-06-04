import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ProductGroup } from '@/api/types'
import { VariantProvider } from '@/lib/variant.tsx'
import { CategoryTile } from './CategoryTile'

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
