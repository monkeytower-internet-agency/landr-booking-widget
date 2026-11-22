/**
 * landr-hdk4y.2 — SecondLanguageQuestions
 *
 * "If no French guide is available, which language would also work?" asked of
 * every guided participant the cart's rule asks (secondLanguage.ts). One helper
 * line above the list (naming the language only when everyone asked shares it),
 * then one bordered block per participant: a checkbox per option plus the
 * exclusive "None of these, only {language}". Ticking the exclusive one clears the
 * others and ticking another clears it; at least one tick is required (the
 * caller gates Continue). The first asked participant can copy their answer to
 * the others.
 *
 * Presentational only: the parent owns the answers (party index → string[]).
 */
import { browserLocale } from '@/lib/locale'
import { secondLanguageText, tr } from '@/lib/strings'
import { languageName } from './participantLanguages'
import { settledSentence, toggleAcceptedLanguage, toggleOnlyMainLanguage } from './secondLanguage'

export interface AskedParticipant {
  /** Party index (the key the answers map uses). */
  index: number
  name: string
  /** The participant's main guiding language (ISO 639-1). */
  main: string
  /** The languages offered as second language, already without `main`. */
  options: readonly string[]
  /** Undefined = unanswered; `[]` = only the main language. */
  answer: readonly string[] | undefined
}

/** A participant who is not asked: a guide of their main language is always on hand (landr-nr4ok). */
export interface SettledParticipant {
  index: number
  name: string
  /** The participant's main guiding language (ISO 639-1). */
  main: string
}

interface Props {
  asked: readonly AskedParticipant[]
  /** Participants explained, not asked. */
  settled?: readonly SettledParticipant[]
  /** The product's main languages, named in the explanation. */
  settledLanguages?: readonly string[]
  onChange: (index: number, answer: string[] | undefined) => void
  onApplyToEveryone: (sourceIndex: number) => void
  locale?: string
}

export function SecondLanguageQuestions({
  asked,
  settled = [],
  settledLanguages = [],
  onChange,
  onApplyToEveryone,
  locale = browserLocale(),
}: Props) {
  const settledLine =
    settled.length > 0 && settledLanguages.length > 0 ? (
      <p className="text-sm text-muted-foreground" data-testid="second-language-settled">
        {settledSentence(settled, settledLanguages, locale)}
      </p>
    ) : null
  if (asked.length === 0) {
    return settledLine ? (
      <section className="flex flex-col gap-3 border-t border-border pt-4">{settledLine}</section>
    ) : null
  }
  const first = asked[0]!
  const sameMain = asked.every((p) => p.main === first.main)
  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-4"
      data-testid="second-language-questions"
    >
      <p className="text-sm text-muted-foreground" data-testid="second-language-helper">
        {sameMain
          ? secondLanguageText('helper', languageName(first.main, locale), locale, first.main)
          : tr('secondLanguageHelperMixed', locale)}
      </p>
      {asked.map((p, position) => {
        const mainName = languageName(p.main, locale)
        const only = Array.isArray(p.answer) && p.answer.length === 0
        const legendId = `second-language-q-${p.index}`
        return (
          <fieldset
            key={p.index}
            className="flex flex-col gap-2 rounded-xl border border-border p-3"
            aria-labelledby={legendId}
            data-testid={`second-language-asked-${p.index}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {mainName}
              </span>
            </div>
            <p id={legendId} className="text-sm font-semibold">
              {secondLanguageText('question', mainName, locale, p.main)}
              <span aria-hidden="true"> *</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {p.options.map((code) => {
                const on = p.answer?.includes(code) === true
                return (
                  <label
                    key={code}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      on ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      data-testid={`second-language-${p.index}-${code}`}
                      onChange={() => onChange(p.index, toggleAcceptedLanguage(p.answer, code))}
                    />
                    {languageName(code, locale)}
                  </label>
                )
              })}
              <label
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  only ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={only}
                  data-testid={`second-language-${p.index}-only`}
                  onChange={() => onChange(p.index, toggleOnlyMainLanguage(p.answer))}
                />
                {secondLanguageText('only', mainName, locale, p.main)}
              </label>
            </div>
            {position === 0 && asked.length > 1 ? (
              <div>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={p.answer === undefined}
                  data-testid="second-language-apply-all"
                  onClick={() => onApplyToEveryone(p.index)}
                >
                  {tr('secondLanguageApplyAll', locale)}
                </button>
              </div>
            ) : null}
          </fieldset>
        )
      })}
      {settledLine}
    </section>
  )
}
