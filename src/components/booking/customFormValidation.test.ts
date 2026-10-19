import { describe, expect, it } from 'vitest'
import { field } from '@/test/customerDetailsFixtures'
import { validateField } from './customFormValidation'

// landr-kcxx5.10: every validation message reads in the customer's language
// (the widget's main table ships en + de; any other locale gets English).

const LOCALES = ['en', 'de', 'de-AT', 'fr-FR', 'es'] as const
const german = (l: string) => l.startsWith('de')

describe('validateField wording per locale', () => {
  it.each(LOCALES)('required (%s)', (l) => {
    const f = field('weight', { label: 'Weight', required: true, field_type: 'number' })
    const msg = validateField(f, {}, 'en', l)
    expect(msg).toBe(german(l) ? 'Weight ist ein Pflichtfeld.' : 'Weight is required.')
    expect(validateField(f, { weight: '  ' }, 'en', l)).toBe(msg)
    expect(validateField(field('x', { label: 'X', required: true, field_type: 'checkbox' }), { x: [] }, 'en', l)).toBe(
      german(l) ? 'X ist ein Pflichtfeld.' : 'X is required.',
    )
  })

  it.each(LOCALES)('text length bounds (%s)', (l) => {
    const f = field('n', { label: 'Name', validation: { min_length: 3, max_length: 5 } })
    expect(validateField(f, { n: 'ab' }, 'en', l)).toBe(
      german(l) ? 'Name muss mindestens 3 Zeichen lang sein.' : 'Name must be at least 3 characters.',
    )
    expect(validateField(f, { n: 'abcdef' }, 'en', l)).toBe(
      german(l) ? 'Name darf höchstens 5 Zeichen lang sein.' : 'Name must be at most 5 characters.',
    )
  })

  it.each(LOCALES)('number bounds (%s)', (l) => {
    const f = field('w', { label: 'Weight', field_type: 'number', validation: { min: 30, max: 200 } })
    expect(validateField(f, { w: '10' }, 'en', l)).toBe(
      german(l) ? 'Weight muss mindestens 30 sein.' : 'Weight must be at least 30.',
    )
    expect(validateField(f, { w: '300' }, 'en', l)).toBe(
      german(l) ? 'Weight darf höchstens 200 sein.' : 'Weight must be at most 200.',
    )
  })

  it.each(LOCALES)('date, pattern and option (%s)', (l) => {
    expect(validateField(field('d', { label: 'Birthday', field_type: 'date', validation: {} }), { d: 'soon' }, 'en', l)).toBe(
      german(l) ? 'Birthday muss ein gültiges Datum sein.' : 'Birthday must be a valid date.',
    )
    expect(validateField(field('p', { label: 'Plate', validation: { pattern: '[A-Z]+' } }), { p: '123' }, 'en', l)).toBe(
      german(l) ? 'Plate hat ein ungültiges Format.' : 'Plate has an invalid format.',
    )
    const sel = field('s', {
      label: 'Diet',
      field_type: 'select',
      validation: {},
      options: [{ value: 'a', label: 'A', label_localized: null }],
    })
    expect(validateField(sel, { s: 'zzz' }, 'en', l)).toBe(
      german(l) ? 'Diet enthält eine ungültige Auswahl.' : 'Diet contains an invalid option.',
    )
  })

  it('returns null for a valid or optional-empty field', () => {
    expect(validateField(field('o', { label: 'O' }), {}, 'en', 'de')).toBeNull()
    expect(validateField(field('o', { label: 'O', required: true }), { o: 'x' }, 'en', 'de')).toBeNull()
  })
})
