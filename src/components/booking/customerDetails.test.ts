import { describe, expect, it } from 'vitest'
import type { CustomerDetails } from '@/api/customerDetailsTypes'
import {
  PENDING_DETAILS,
  PEOPLE,
  declarationsModule,
  insuranceModule,
} from '@/test/customerDetailsFixtures'
import {
  collectForms,
  entryToDetailsResponse,
  initialAnswersFor,
  rosterSources,
} from './customerDetails'
import { PERSON_ANSWERS_DRAFT_KEY } from './formScopes'

describe('collectForms', () => {
  it('dedupes a form that sits under two products by form.key', () => {
    const details: CustomerDetails = {
      pending: true,
      forms: [
        { product_id: 'p1', product_name: 'Tandem', modules: [declarationsModule(), insuranceModule()] },
        { product_id: 'p2', product_name: 'Dinner', modules: [declarationsModule()] },
      ],
    }
    const steps = collectForms(details)
    expect(steps.map((s) => s.form.key)).toEqual(['declarations', 'insurance'])
    expect(steps[0].productName).toBe('Tandem')
    expect(steps[0].flow.modules?.[0].form?.key).toBe('declarations')
  })

  it('orders modules by position and skips non custom_form modules', () => {
    const details: CustomerDetails = {
      pending: true,
      forms: [
        {
          product_id: 'p1',
          product_name: 'Tandem',
          modules: [
            insuranceModule(5),
            { kind: 'language', position: 1, form: null },
            declarationsModule(2),
          ],
        },
      ],
    }
    expect(collectForms(details).map((s) => s.form.key)).toEqual(['declarations', 'insurance'])
  })

  it('is empty without forms', () => {
    expect(collectForms({ pending: true })).toEqual([])
  })
})

describe('rosterSources', () => {
  it('maps participants and guests, keeping the booking_participant_id as id', () => {
    const r = rosterSources(PEOPLE)
    expect(r.participants.map((p) => [p.id, p.first_name])).toEqual([
      ['pa', 'Ann Pilot'],
      ['pb', 'Ben Pilot'],
    ])
    expect(r.companions.map((p) => [p.id, p.first_name])).toEqual([['gc', 'Cleo Guest']])
  })
})

describe('initialAnswersFor', () => {
  it('rides the per-person answers in the reserved draft key', () => {
    const d: CustomerDetails = {
      ...PENDING_DETAILS,
      answers: [
        { form_key: 'declarations', answers: { licence: 'X1' }, people: { pa: { weight_kg: 80 } } },
      ],
    }
    expect(initialAnswersFor(d, 'declarations')).toEqual({
      licence: 'X1',
      [PERSON_ANSWERS_DRAFT_KEY]: { pa: { weight_kg: 80 } },
    })
    expect(initialAnswersFor(d, 'insurance')).toBeUndefined()
  })
})

describe('entryToDetailsResponse', () => {
  it('re-keys index-aligned person answers by booking_participant_id', () => {
    const r = entryToDetailsResponse(
      {
        form_key: 'declarations',
        answers: { licence: 'X1' },
        participant_answers: [{ weight_kg: '80', diet: 'vegan' }, { weight_kg: '90' }],
        companion_answers: [{ diet: 'none' }],
      },
      rosterSources(PEOPLE),
    )
    expect(r).toEqual({
      form_key: 'declarations',
      answers: { licence: 'X1' },
      people: {
        pa: { weight_kg: '80', diet: 'vegan' },
        pb: { weight_kg: '90' },
        gc: { diet: 'none' },
      },
    })
  })

  it('omits people with no answers', () => {
    const r = entryToDetailsResponse(
      { form_key: 'f', answers: {}, participant_answers: [{}, { a: 'b' }] },
      rosterSources(PEOPLE),
    )
    expect(r.people).toEqual({ pb: { a: 'b' } })
  })
})
