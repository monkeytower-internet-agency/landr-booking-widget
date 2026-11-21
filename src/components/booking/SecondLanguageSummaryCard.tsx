/**
 * landr-kq0l4 — the second-guiding-language answers as a finished summary on
 * Review. They are asked on the Language step; "Edit" goes back to it. When an
 * answer is still missing (a product added on Review asks someone new) the line
 * says so and Confirm stays disabled.
 */
import { Button } from '@/components/ui/button'
import { browserLocale } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { languageName } from './participantLanguages'
import type { AskedParticipant } from './SecondLanguageQuestions'

export interface SecondLanguageSummaryCardProps {
  asked: readonly AskedParticipant[]
  onEdit?: () => void
}

export function SecondLanguageSummaryCard({ asked, onEdit }: SecondLanguageSummaryCardProps) {
  const locale = browserLocale()
  if (asked.length === 0) return null
  return (
    <section
      data-testid="review-second-language"
      className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tr('reviewSecondLanguageTitle', locale)}</h3>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid="review-second-language-edit"
          >
            {tr('reviewEditLabel', locale)}
          </Button>
        ) : null}
      </div>
      <div className="text-sm" data-testid="review-second-language-lines">
        {asked.map((p) => {
          const answer = p.answer
          const text = !Array.isArray(answer)
            ? tr('reviewSecondLanguageMissing', locale)
            : answer.length === 0
              ? fmt(tr('reviewSecondLanguageOnlyMain', locale), {
                  language: languageName(p.main, locale),
                })
              : answer.map((code) => languageName(code, locale)).join(', ')
          return (
            <span
              key={p.index}
              className="block"
              data-testid={`review-second-language-${p.index}`}
            >
              <span className="font-medium">{p.name}</span>: {text}
            </span>
          )
        })}
      </div>
    </section>
  )
}
