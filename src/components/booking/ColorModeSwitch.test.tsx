import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ColorModeSwitch } from './ColorModeSwitch'
import { resetColorModeForTests, setOperatorColorMode, startColorMode } from '@/lib/colorMode'

describe('ColorModeSwitch', () => {
  afterEach(() => resetColorModeForTests())

  it('flips the widget between dark and light', () => {
    startColorMode('?w=x')
    setOperatorColorMode('dark')
    render(<ColorModeSwitch />)
    const btn = screen.getByTestId('color-mode-switch')
    expect(btn).toHaveAccessibleName('Switch to light mode')
    fireEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('color-mode-switch')).toHaveAccessibleName('Switch to dark mode')
  })
})
