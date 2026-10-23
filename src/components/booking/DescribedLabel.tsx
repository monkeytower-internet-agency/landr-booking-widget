/**
 * landr-soewf: a price label that can carry the operator's explanation of a
 * named weekday / start-time price ("Our pilots earn a little bit more during
 * the weekend."). Without a description it is just the text. With one, the
 * description is the hover/title text and a chevron next to the label opens it
 * (hidden by default). Used by the product page's price notes and the price
 * breakdown's surcharge / discount rows.
 */
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { browserLocale } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { cn } from '@/lib/utils'

export interface DescribedLabelProps {
  /** Text shown before the label (e.g. "+ "). */
  prefix?: string
  /** The text shown. */
  text: string
  /** Name used in the chevron's accessible label. Defaults to `text`. */
  name?: string
  description?: string | null
  testId?: string
}

export function DescribedLabel({ prefix = '', text, name, description, testId }: DescribedLabelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const locale = browserLocale()
  const detail = description?.trim()
  if (!detail) return <span>{prefix}{text}</span>
  const who = name || text
  return (
    <span className="min-w-0" title={detail} data-testid={testId}>
      <span>{prefix}{text}</span>
      <button
        type="button"
        className="ml-1 inline-flex size-5 items-center justify-center rounded align-middle text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={fmt(tr(open ? 'priceNoteDetailsHide' : 'priceNoteDetailsShow', locale), { name: who })}
        data-testid={testId ? `${testId}-toggle` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <span
          id={panelId}
          className="mt-0.5 block text-xs font-normal text-muted-foreground"
          data-testid={testId ? `${testId}-description` : undefined}
        >
          {detail}
        </span>
      ) : null}
    </span>
  )
}
