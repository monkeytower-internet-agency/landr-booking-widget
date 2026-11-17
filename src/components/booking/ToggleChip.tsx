/** Pill toggle button: outlined "+ label" when off, filled "✓ label" when on. */
import type { ReactNode } from 'react'

interface Props {
  on: boolean
  disabled?: boolean
  onToggle: () => void
  children: ReactNode
  'data-testid'?: string
  className?: string
}

export function ToggleChip({ on, disabled, onToggle, children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      data-testid={rest['data-testid']}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent text-foreground hover:bg-muted'
      } ${className}`}
    >
      {on ? '✓' : '+'} {children}
    </button>
  )
}
