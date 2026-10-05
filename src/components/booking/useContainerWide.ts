import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * landr-53vao: container (not viewport) width at/above which the multi-day
 * calendar shows two months side by side. The widget runs inside host
 * iframes and embeds, so `window.innerWidth` says nothing about the room the
 * picker actually has.
 */
export const WIDE_CALENDAR_MIN_REM = 40

function pxPerRem(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 16
  const size = parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  )
  return Number.isFinite(size) && size > 0 ? size : 16
}

/**
 * True while the element behind `ref` is at least `minRem` wide. Driven by a
 * ResizeObserver on the element itself; where ResizeObserver is missing
 * (older embeds, jsdom) it settles on the one-off initial measurement and
 * stays narrow when that is 0.
 */
export function useContainerWide(
  ref: RefObject<HTMLElement | null>,
  minRem: number = WIDE_CALENDAR_MIN_REM,
): boolean {
  const [wide, setWide] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const threshold = () => minRem * pxPerRem()
    setWide(el.getBoundingClientRect().width >= threshold())
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      setWide(entry.contentRect.width >= threshold())
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, minRem])

  return wide
}
