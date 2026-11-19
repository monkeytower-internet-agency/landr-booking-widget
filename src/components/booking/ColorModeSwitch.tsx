import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setDark, useIsDark } from '@/lib/colorMode'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'

/**
 * landr-a5i49.3 — visitor light/dark switch (operator setting
 * widget_color_switcher). The pick is the visitor's own and wins over the
 * operator default; lib/colorMode.ts remembers it for the next visit.
 */
export function ColorModeSwitch() {
  const dark = useIsDark()
  const label = tr(dark ? 'switchToLight' : 'switchToDark', browserLocale())
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      data-testid="color-mode-switch"
      onClick={() => setDark(!dark)}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
