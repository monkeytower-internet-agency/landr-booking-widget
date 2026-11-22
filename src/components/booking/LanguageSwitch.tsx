import { Check, ChevronDown, Globe } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/components/ui/button'
import {
  browserLocale,
  languageOptions,
  setVisitorLang,
} from '@/lib/locale'
import { loadUiCatalog, resolveUiLanguage, tr } from '@/lib/strings'

/** Each language's own name, so a visitor can find theirs in any UI language. */
const NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  tr: 'Türkçe',
  fr: 'Français',
}

/**
 * landr-goi5m.3 — visitor language dropdown (operator setting
 * widget_language_switcher). Loads the catalog first so the whole app flips in
 * one render; App subscribes to the visitor-language store, so no remount.
 */
export function LanguageSwitch() {
  const options = languageOptions()
  if (options.length === 0) return null
  const locale = browserLocale()
  const current = resolveUiLanguage(locale)
  const label = tr('switchLanguage', locale)
  const choose = (code: string) => {
    void loadUiCatalog(code).then(() => setVisitorLang(code))
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          title={label}
          data-testid="language-switch"
        >
          <Globe className="size-4" />
          <span className="uppercase">{current}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.map((code) => (
            <DropdownMenu.Item
              key={code}
              data-testid={`language-option-${code}`}
              onSelect={() => choose(code)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
            >
              <span>{NATIVE_NAMES[code] ?? code}</span>
              {code === current ? <Check className="size-4" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
