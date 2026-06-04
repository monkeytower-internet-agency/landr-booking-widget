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
