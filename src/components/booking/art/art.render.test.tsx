import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CategoryArt } from './CategoryArt'
import { ProductArt } from './ProductArt'

/**
 * The randomly-generated useId() prefix differs per mount, so we normalise the
 * gradient/pattern ids before comparing markup — what we assert is that the
 * *structure* (gradient angle, accent geometry, icon paths) is identical for a
 * given seed and differs across seeds.
 */
function normalize(html: string): string {
  return html
    .replace(/(g|r|t)-[a-z0-9]+/gi, '$1-X')
    .replace(/url\(#(g|r|t)-[^)]+\)/gi, 'url(#$1-X)')
    .replace(/id="(g|r|t)-[^"]+"/gi, 'id="$1-X"')
}

describe('CategoryArt / ProductArt determinism (landr-d8rg.3)', () => {
  it('CategoryArt renders identically for the same seed', () => {
    const a = normalize(render(<CategoryArt seed="mountain-tours" aspect="4:3" />).container.innerHTML)
    const b = normalize(render(<CategoryArt seed="mountain-tours" aspect="4:3" />).container.innerHTML)
    expect(a).toBe(b)
  })

  it('CategoryArt renders differently for different seeds', () => {
    const a = normalize(render(<CategoryArt seed="mountain-tours" aspect="4:3" />).container.innerHTML)
    const b = normalize(render(<CategoryArt seed="city-getaways" aspect="4:3" />).container.innerHTML)
    expect(a).not.toBe(b)
  })

  it('ProductArt renders identically for the same seed + kind', () => {
    const a = normalize(
      render(<ProductArt seed="p-100" kind="tandem flight" aspect="16:9" />).container.innerHTML,
    )
    const b = normalize(
      render(<ProductArt seed="p-100" kind="tandem flight" aspect="16:9" />).container.innerHTML,
    )
    expect(a).toBe(b)
  })

  it('renders an accessible <img> role + title when a title is given', () => {
    const { getByRole } = render(
      <ProductArt seed="p-1" aspect="4:3" title="Sunset Tandem Flight" />,
    )
    expect(getByRole('img', { name: 'Sunset Tandem Flight' })).toBeInTheDocument()
  })

  it('is aria-hidden (decorative) when no title is given', () => {
    const { container } = render(<CategoryArt seed="c-1" aspect="1:1" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('every aspect produces a valid viewBox', () => {
    for (const aspect of ['4:3', '16:9', '1:1', '3:2'] as const) {
      const { container } = render(<ProductArt seed={`s-${aspect}`} aspect={aspect} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/)
    }
  })
})
