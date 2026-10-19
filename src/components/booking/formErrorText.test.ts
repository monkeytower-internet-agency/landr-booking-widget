import { describe, expect, it } from 'vitest'
import { field } from '@/test/customerDetailsFixtures'
import { localizeFieldError } from './formErrorText'

// landr-kcxx5.10: the API's per-field 422 items read in the customer's
// language; unknown codes keep the server message.

const weight = field('weight_kg', {
  label: 'Weight',
  field_type: 'number',
  validation: { min: 30, max: 200, min_length: 2, max_length: 9 },
})
const date = field('born', { label: 'Birthday', field_type: 'date' })

const e = (code: string, message = 'server says no') => ({ field_key: 'weight_kg', code, message })

describe('localizeFieldError', () => {
  it.each([
    ['required', 'Weight is required.', 'Weight ist ein Pflichtfeld.'],
    ['type', 'Weight has an invalid value.', 'Weight hat einen ungültigen Wert.'],
    ['option', 'Weight contains an invalid option.', 'Weight enthält eine ungültige Auswahl.'],
    ['pattern', 'Weight has an invalid format.', 'Weight hat ein ungültiges Format.'],
    ['min', 'Weight must be at least 30.', 'Weight muss mindestens 30 sein.'],
    ['max', 'Weight must be at most 200.', 'Weight darf höchstens 200 sein.'],
    ['min_length', 'Weight must be at least 2 characters.', 'Weight muss mindestens 2 Zeichen lang sein.'],
    ['max_length', 'Weight must be at most 9 characters.', 'Weight darf höchstens 9 Zeichen lang sein.'],
  ])('maps %s in en and de', (code, en, de) => {
    expect(localizeFieldError(e(code), weight, 'en')).toBe(en)
    expect(localizeFieldError(e(code), weight, 'de-DE')).toBe(de)
    // a locale without a bundle gets English
    expect(localizeFieldError(e(code), weight, 'es')).toBe(en)
  })

  it('names a date type error as a date problem', () => {
    expect(localizeFieldError({ field_key: 'born', code: 'type', message: 'm' }, date, 'de')).toBe(
      'Birthday muss ein gültiges Datum sein.',
    )
  })

  it('falls back to the field key when no definition is at hand', () => {
    expect(localizeFieldError(e('required'), undefined, 'de')).toBe('weight_kg ist ein Pflichtfeld.')
  })

  it('keeps the server message for an unknown code', () => {
    expect(localizeFieldError(e('out_of_range', 'Weight must be at most 200.'), weight, 'de')).toBe(
      'Weight must be at most 200.',
    )
  })

  it('keeps the server message when a bound is unknown (no definition)', () => {
    expect(localizeFieldError(e('min', 'must be >= 30'), undefined, 'de')).toBe('must be >= 30')
  })
})
