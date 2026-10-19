import { describe, expect, it } from 'vitest'
import type { components } from '@/types/api.gen'
import type {
  CustomerDetails,
  CustomerDetailsPutBody,
} from './customerDetailsTypes'

// Compile-time pins (checked by `tsc -b`): our hand-written wire types must
// stay assignable to / from the generated schema.
type Gen = components['schemas']
const _getShape = (d: Gen['CustomerDetailsOut']): CustomerDetails => ({
  pending: d.pending,
  requested_at: d.requested_at,
  completed_at: d.completed_at,
  people: d.people,
  answers: d.answers,
})
const _putShape = (b: CustomerDetailsPutBody): Gen['CustomerDetailsIn'] => b

describe('customer details wire types', () => {
  it('are pinned to the generated schema at compile time', () => {
    expect(typeof _getShape).toBe('function')
    expect(typeof _putShape).toBe('function')
  })
})
