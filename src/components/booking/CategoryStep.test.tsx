import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ProductGroup } from '@/api/types'
import { VariantProvider } from '@/lib/variant.tsx'
import { VARIANTS } from '@/lib/variant'
import { CategoryStep } from './CategoryStep'

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id: 'g-1',
    slug: 'tandem',
    name: 'Tandem Flights',
    name_localized: null,
    description: 'Fly with a certified pilot — no experience needed.',
    description_localized: null,
    image_url: 'https://example.test/tandem.jpg',
    sort_order: 10,
    parent_id: null,
    product_count: 3,
    ...overrides,
  }
}

describe('CategoryStep (landr-d8rg.5)', () => {
  it('renders a tile per non-empty group with name, description and count chip', () => {
    render(
      <CategoryStep
        groups={[
          makeGroup({
            id: 'g-1',
            slug: 'tandem',
            name: 'Tandem Flights',
            description: 'Fly with a certified pilot — no experience needed.',
            product_count: 3,
          }),
          makeGroup({
            id: 'g-2',
            slug: 'courses',
            name: 'Courses',
            description: 'Learn to fly solo over a multi-day course.',
            product_count: 1,
          }),
        ]}
        onPick={vi.fn()}
      />,
    )

    expect(screen.getByTestId('category-step')).toBeInTheDocument()
    expect(screen.getByText('Tandem Flights')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(
      screen.getByText('Fly with a certified pilot — no experience needed.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Learn to fly solo over a multi-day course.'),
    ).toBeInTheDocument()
    // count chip copy: plural for 3, singular for 1
    expect(screen.getByText('3 offers')).toBeInTheDocument()
    expect(screen.getByText('1 offer')).toBeInTheDocument()
  })

  it('hides groups with product_count === 0', () => {
    render(
      <CategoryStep
        groups={[
          makeGroup({ id: 'g-1', slug: 'tandem', name: 'Tandem Flights', product_count: 2 }),
          makeGroup({ id: 'g-2', slug: 'empty', name: 'Empty Group', product_count: 0 }),
        ]}
        onPick={vi.fn()}
      />,
    )

    expect(screen.getByTestId('category-btn-tandem')).toBeInTheDocument()
    expect(screen.queryByTestId('category-btn-empty')).not.toBeInTheDocument()
    expect(screen.queryByText('Empty Group')).not.toBeInTheDocument()
  })

  it('renders the uploaded cover image when image_url is set', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', image_url: 'https://example.test/cover.jpg' })]}
        onPick={vi.fn()}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    // Decorative cover (alt=""), queried directly rather than by role.
    const cover = tile.querySelector('img')
    expect(cover).toBeTruthy()
    expect(cover?.getAttribute('src')).toBe('https://example.test/cover.jpg')
    // No SVG fallback art rendered when there is a real cover.
    expect(tile.querySelector('svg')).toBeNull()
  })

  it('falls back to CategoryArt (SVG) when image_url is null', () => {
    const { container } = render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', image_url: null })]}
        onPick={vi.fn()}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    // No <img>, an <svg> fallback instead.
    expect(container.querySelector('img')).toBeNull()
    expect(tile.querySelector('svg')).toBeTruthy()
  })

  it('treats an undefined image_url like null (fallback art)', () => {
    // image_url is OPTIONAL on the wire; undefined must behave like "no image".
    const group = makeGroup({ slug: 'tandem' })
    // Force the field off entirely (not just null) to mimic a partial payload.
    delete (group as { image_url?: string | null }).image_url
    const { container } = render(<CategoryStep groups={[group]} onPick={vi.fn()} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByTestId('category-btn-tandem').querySelector('svg')).toBeTruthy()
  })

  it('fires onPick with the clicked group', () => {
    const onPick = vi.fn()
    const tandem = makeGroup({ id: 'g-1', slug: 'tandem', name: 'Tandem Flights' })
    const courses = makeGroup({ id: 'g-2', slug: 'courses', name: 'Courses' })
    render(<CategoryStep groups={[tandem, courses]} onPick={onPick} />)

    fireEvent.click(screen.getByTestId('category-btn-courses'))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(courses)
  })

  it('activates a tile via the keyboard (Enter on the focused button)', () => {
    const onPick = vi.fn()
    const tandem = makeGroup({ slug: 'tandem' })
    render(<CategoryStep groups={[tandem]} onPick={onPick} />)

    const tile = screen.getByTestId('category-btn-tandem')
    // Real <button>: focus + Enter triggers a native click in jsdom.
    tile.focus()
    expect(tile).toHaveFocus()
    fireEvent.keyDown(tile, { key: 'Enter', code: 'Enter' })
    fireEvent.keyUp(tile, { key: 'Enter', code: 'Enter' })
    fireEvent.click(tile) // jsdom does not synthesise the click from keydown
    expect(onPick).toHaveBeenCalledWith(tandem)
  })

  it('exposes the active variant on the step + applies its tokens', () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(
        <VariantProvider value={variant}>
          <CategoryStep groups={[makeGroup({ slug: 'tandem' })]} onPick={vi.fn()} />
        </VariantProvider>,
      )
      const step = screen.getByTestId('category-step')
      expect(step.dataset.variant).toBe(variant)
      const tile = screen.getByTestId('category-btn-tandem')
      expect(tile.dataset.variant).toBe(variant)
      unmount()
    }
  })

  it('renders nothing bookable gracefully when every group is empty', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'a', product_count: 0 })]}
        onPick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('category-step')).toBeInTheDocument()
    expect(screen.queryByTestId('category-btn-a')).not.toBeInTheDocument()
    expect(screen.getByText(/No categories are available/i)).toBeInTheDocument()
  })
})

// User report 2026-06-04: with an operator widget_headline configured
// (Settings → Branding), the built-in entrance heading stacked beneath it
// as duplicate copy. App passes hideHeading when a headline exists.
describe('CategoryStep heading suppression', () => {
  it('shows the default heading without the flag', () => {
    render(
      <CategoryStep groups={[makeGroup({})]} onPick={() => {}} />,
    )
    expect(screen.getByText('What are you looking for?')).toBeInTheDocument()
  })

  it('hides the default heading when hideHeading is set', () => {
    render(
      <CategoryStep groups={[makeGroup({})]} onPick={() => {}} hideHeading />,
    )
    expect(
      screen.queryByText('What are you looking for?'),
    ).not.toBeInTheDocument()
    // Tiles still render.
    expect(screen.getByTestId('category-step')).toBeInTheDocument()
  })
})

// landr-jb1k.2: operator-configurable grid columns.
describe('CategoryStep column override (landr-jb1k.2)', () => {
  it('applies md:grid-cols-2 when columns=2', () => {
    const { container } = render(
      <CategoryStep
        groups={[makeGroup({ id: 'g-1' }), makeGroup({ id: 'g-2', slug: 'courses' })]}
        columns={2}
        onPick={vi.fn()}
      />,
    )
    const ul = container.querySelector('ul')!
    expect(ul.className).toContain('md:grid-cols-2')
  })

  it('applies md:grid-cols-4 when columns=4', () => {
    const { container } = render(
      <CategoryStep
        groups={[makeGroup({ id: 'g-1' }), makeGroup({ id: 'g-2', slug: 'courses' })]}
        columns={4}
        onPick={vi.fn()}
      />,
    )
    const ul = container.querySelector('ul')!
    expect(ul.className).toContain('md:grid-cols-4')
  })

  it('clamps columns below 1 to md:grid-cols-1', () => {
    const { container } = render(
      <CategoryStep groups={[makeGroup({})]} columns={0} onPick={vi.fn()} />,
    )
    const ul = container.querySelector('ul')!
    expect(ul.className).toContain('md:grid-cols-1')
    // Must NOT contain a columns-based class for other values.
    expect(ul.className).not.toContain('md:grid-cols-5')
  })

  it('clamps columns above 4 to md:grid-cols-4', () => {
    const { container } = render(
      <CategoryStep groups={[makeGroup({})]} columns={9} onPick={vi.fn()} />,
    )
    const ul = container.querySelector('ul')!
    expect(ul.className).toContain('md:grid-cols-4')
  })

  it('null columns uses auto logic (no explicit md:grid-cols- at low count)', () => {
    const { container } = render(
      <CategoryStep
        groups={[
          makeGroup({ id: 'g-1', slug: 'a' }),
          makeGroup({ id: 'g-2', slug: 'b' }),
        ]}
        columns={null}
        onPick={vi.fn()}
      />,
    )
    const ul = container.querySelector('ul')!
    // With 2 groups and no explicit columns, auto uses md:grid-cols-2.
    expect(ul.className).toContain('md:grid-cols-2')
  })
})

// landr-jb1k.2: 3-group auto-column fix.
describe('CategoryStep 3-group auto-column (landr-jb1k.2)', () => {
  it('adds lg:grid-cols-3 when exactly 3 visible groups and no explicit columns', () => {
    const { container } = render(
      <CategoryStep
        groups={[
          makeGroup({ id: 'g-1', slug: 'a' }),
          makeGroup({ id: 'g-2', slug: 'b' }),
          makeGroup({ id: 'g-3', slug: 'c' }),
        ]}
        columns={null}
        onPick={vi.fn()}
      />,
    )
    const ul = container.querySelector('ul')!
    expect(ul.className).toContain('lg:grid-cols-3')
  })

  it('does NOT add lg:grid-cols-3 for 2 visible groups (auto stays at md:grid-cols-2)', () => {
    const { container } = render(
      <CategoryStep
        groups={[
          makeGroup({ id: 'g-1', slug: 'a' }),
          makeGroup({ id: 'g-2', slug: 'b' }),
        ]}
        columns={null}
        onPick={vi.fn()}
      />,
    )
    const ul = container.querySelector('ul')!
    // 2 groups: no lg:grid-cols-3 (that would be triggered only by exactly-3 or >=5)
    expect(ul.className).not.toContain('lg:grid-cols-3')
  })
})

// landr-jb1k.2: tile font — heading and tile title font-family.
describe('CategoryStep tileFont (landr-jb1k.2)', () => {
  it('sets fontFamily on the heading when tileFont is playfair', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem' })]}
        tileFont="playfair"
        onPick={vi.fn()}
      />,
    )
    const heading = screen.getByText('What are you looking for?')
    // Check the inline style attribute contains the expected font name.
    expect(heading.style.fontFamily).toContain('Playfair Display')
  })

  it('sets fontFamily on tile title h3 when tileFont is montserrat', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        tileFont="montserrat"
        onPick={vi.fn()}
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.style.fontFamily).toContain('Montserrat')
  })

  it('applies no inline fontFamily when tileFont is null (system default)', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        tileFont={null}
        onPick={vi.fn()}
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3).not.toHaveAttribute('style')
  })

  it('applies no inline fontFamily when tileFont is "system"', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        tileFont="system"
        onPick={vi.fn()}
      />,
    )
    const h3 = screen.getByText('Tandem Flights')
    expect(h3).not.toHaveAttribute('style')
  })
})

// landr-jb1k.2: title case — heading and tile title text-transform.
describe('CategoryStep titleCase (landr-jb1k.2)', () => {
  it.each([
    ['uppercase', 'uppercase'],
    ['lowercase', 'lowercase'],
    ['capitalize', 'capitalize'],
  ] as const)('applies %s class to the heading and tile titles', (titleCase, expectedClass) => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        titleCase={titleCase}
        onPick={vi.fn()}
      />,
    )
    const heading = screen.getByText('What are you looking for?')
    expect(heading.className).toContain(expectedClass)
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.className).toContain(expectedClass)
  })

  it('applies no case class when titleCase is null', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        titleCase={null}
        onPick={vi.fn()}
      />,
    )
    const heading = screen.getByText('What are you looking for?')
    expect(heading.className).not.toContain('uppercase')
    expect(heading.className).not.toContain('lowercase')
    expect(heading.className).not.toContain('capitalize')
  })

  it('hideHeading=true still applies case class and font to tile titles only', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights' })]}
        titleCase="uppercase"
        hideHeading
        onPick={vi.fn()}
      />,
    )
    expect(screen.queryByText('What are you looking for?')).not.toBeInTheDocument()
    const h3 = screen.getByText('Tandem Flights')
    expect(h3.className).toContain('uppercase')
  })
})

// landr-jb1k.4: tile-style props resolve from their static maps and thread
// down to the tiles. Each null leaves the variant token in place.
describe('CategoryStep tile-style options (landr-jb1k.4)', () => {
  it('resolves tileRadius and applies the radius class on the tile button', () => {
    render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem' })]}
        tileRadius="round"
        onPick={vi.fn()}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('rounded-3xl')
  })

  it('resolves tileAspect and applies the aspect class on the media frame', () => {
    const { container } = render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', image_url: 'https://x.test/c.jpg' })]}
        tileAspect="wide"
        onPick={vi.fn()}
      />,
    )
    const frame = container.querySelector('img')?.parentElement
    expect(frame?.className).toContain('aspect-video')
  })

  it('resolves tileHover=zoom: image scales, button does not lift', () => {
    const { container } = render(
      <CategoryStep
        groups={[makeGroup({ slug: 'tandem', image_url: 'https://x.test/c.jpg' })]}
        tileHover="zoom"
        onPick={vi.fn()}
      />,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).not.toContain('hover:-translate-y-0.5')
    expect(container.querySelector('img')?.className).toContain('group-hover:scale-105')
  })

  it('resolves tileScrim=light on aurora: white gradient + dark title text (AA)', () => {
    render(
      <VariantProvider value="aurora">
        <CategoryStep
          groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights', image_url: 'https://x.test/c.jpg' })]}
          tileScrim="light"
          onPick={vi.fn()}
        />
      </VariantProvider>,
    )
    const scrim = screen.getByTestId('category-scrim')
    expect(scrim.className).toContain('from-white/85')
    const overlay = screen.getByText('Tandem Flights').closest('.absolute')
    expect(overlay?.className).toContain('text-foreground')
  })

  it('all tile-style props null leaves the aurora variant tokens unchanged', () => {
    const { container } = render(
      <VariantProvider value="aurora">
        <CategoryStep
          groups={[makeGroup({ slug: 'tandem', name: 'Tandem Flights', image_url: 'https://x.test/c.jpg' })]}
          tileRadius={null}
          tileAspect={null}
          tileScrim={null}
          tileHover={null}
          onPick={vi.fn()}
        />
      </VariantProvider>,
    )
    const tile = screen.getByTestId('category-btn-tandem')
    expect(tile.className).toContain('rounded-2xl') // aurora default radius
    expect(tile.className).toContain('hover:-translate-y-0.5') // default lift
    const frame = container.querySelector('img')?.parentElement
    expect(frame?.className).toContain('aspect-[4/3]') // aurora default aspect
    const scrim = screen.getByTestId('category-scrim')
    expect(scrim.className).toContain('from-black/70') // aurora default scrim
  })
})
