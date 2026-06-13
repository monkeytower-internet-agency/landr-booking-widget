/**
 * landr-71kz.3 — EQUIVALENCE SUITE (the acceptance bar).
 *
 * The step machine was refactored from hardcoded `if (hotel) … else if (pickup)
 * …` ladders into plan-index WALKS over the FlowModule[] that `buildFlowPlan`
 * yields. With a null remoteFlow that plan is the LEGACY plan, and this suite
 * proves the walk reproduces TODAY's routing BIT-FOR-BIT across EVERY
 * hotel_offering × needs_pickup × declarations permutation.
 *
 * The expectations here are written as an INDEPENDENT oracle — the routing rules
 * the widget shipped with before this refactor — NOT by re-deriving them from
 * the new implementation. If a future change to the walk diverges from today's
 * behaviour, one of these assertions fails. This is the regression safety net
 * the EPIC A plan (top risk #1) requires.
 *
 * It also covers the tolerant-parse contract (malformed remoteFlow → legacy
 * plan, NEVER throw — landr-9ut4) and the remote-flow happy path.
 */
import { describe, expect, it } from 'vitest'

import type { HotelOffering, Product } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import {
  buildBreadcrumb,
  stepAfterAccommodation,
  stepBefore,
  stepBeforeReview,
  type Step,
} from './appStepMachine'
import { buildFlowPlan, type FlowModule } from './flowPlan'

// ─── Fixtures (mirroring appStepMachine.test.ts) ────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Test Product',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 30,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    ...overrides,
  }
}

const SLOT_SELECTION: BookingSelection = {
  kind: 'slot',
  slot: {
    availability_id: 'a-1',
    date: '2026-05-20',
    start_time: '09:00',
    end_time: '10:00',
    capacity: 4,
    capacity_reserved: 0,
    available_seats: 4,
    status: 'open',
  },
}

const ADA: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600000000',
}

function makeParticipants(n: number): ParticipantDetails[] {
  const rows: ParticipantDetails[] = []
  for (let i = 0; i < Math.max(1, n); i += 1) {
    rows.push({
      first_name: i === 0 ? ADA.first_name : `P${i + 1}`,
      last_name: 'Doe',
      email: '',
      phone: '',
      service_role_code: '',
    })
  }
  return rows
}

const NO_COMPANIONS: CompanionDetails[] = []

// All permutations of the three routing axes.
const HOTEL_OFFERINGS: HotelOffering[] = ['none', 'optional', 'mandatory']
const NEEDS_PICKUP = [true, false]
const REQUIRES_DECLARATIONS = [true, false]

// Whether the customer actually booked a hotel room (only possible when the
// product offers one). null = no hotel booked (guiding-only opt-out / no offer).
const HOTEL_BOOKED = [true, false]

function offeringHasHotel(o: HotelOffering): boolean {
  return o !== 'none'
}

// ─── The independent ORACLE: today's routing rules ──────────────────────────

/**
 * What the funnel's PROVENANCE looks like after the upstream steps, for a given
 * permutation. `hadServiceAddons` mirrors App.tsx: the add-ons probe only runs
 * for NON-hotel service products, so a hotel-offering product never has it.
 */
interface FunnelCtx {
  offering: HotelOffering
  needsPickup: boolean
  hotelBooked: boolean
  hadServiceAddons: boolean
}

/** The hotel location id for the permutation (null when no hotel booked). */
function hotelLocId(ctx: FunnelCtx): string | null {
  return ctx.hotelBooked ? 'loc-hotel' : null
}

/**
 * ORACLE for the FORWARD step after accommodation (the old hardcoded ladder):
 *   hotel booked → fill-form (hotel as pickup);
 *   else needs_pickup → pick-pickup;
 *   else fill-form (pickup null).
 * Returns the expected Step['name'].
 */
function oracleStepAfterAccommodation(ctx: FunnelCtx): Step['name'] {
  if (ctx.hotelBooked) return 'fill-form'
  if (ctx.needsPickup) return 'pick-pickup'
  return 'fill-form'
}

/**
 * ORACLE for the BACK target from the review/declarations terminus (the old
 * stepBeforeReview ladder):
 *   hotel booked OR product offers a hotel → pick-accommodation;
 *   else needs_pickup → pick-pickup;
 *   else hadServiceAddons → pick-service-addons;
 *   else details.
 */
function oracleStepBeforeReview(ctx: FunnelCtx): Step['name'] {
  if (ctx.hotelBooked || offeringHasHotel(ctx.offering)) return 'pick-accommodation'
  if (ctx.needsPickup) return 'pick-pickup'
  if (ctx.hadServiceAddons) return 'pick-service-addons'
  return 'details'
}

function reviewArgs(ctx: FunnelCtx) {
  return {
    product: makeProduct({
      hotel_offering: ctx.offering,
      needs_pickup: ctx.needsPickup,
    }),
    selection: SLOT_SELECTION,
    booker: ADA,
    participants: makeParticipants(2),
    companions: NO_COMPANIONS,
    pickupLocationId: ctx.hotelBooked ? 'loc-hotel' : ('loc-free' as string | null),
    accommodationRooms: ctx.hotelBooked
      ? [{ productId: 'room-1', quantity: 1 }]
      : [],
    addons: ctx.hadServiceAddons
      ? [{ productId: 'addon-1', quantity: 1 }]
      : [],
    hotelLocationId: hotelLocId(ctx),
    hadServiceAddons: ctx.hadServiceAddons,
  }
}

// Enumerate the realistic funnel permutations. A hotel can only be booked when
// the product offers one; service-add-ons only run on non-hotel products.
function* permutations(): Generator<FunnelCtx> {
  for (const offering of HOTEL_OFFERINGS) {
    for (const needsPickup of NEEDS_PICKUP) {
      for (const hotelBooked of HOTEL_BOOKED) {
        // A hotel can't be booked on a product that offers none.
        if (hotelBooked && !offeringHasHotel(offering)) continue
        // Hotel-offering products never run the add-ons probe; non-hotel
        // service products may or may not have add-ons.
        const addonStates = offeringHasHotel(offering) ? [false] : [true, false]
        for (const hadServiceAddons of addonStates) {
          yield { offering, needsPickup, hotelBooked, hadServiceAddons }
        }
      }
    }
  }
}

function permLabel(ctx: FunnelCtx): string {
  return `offering=${ctx.offering} pickup=${ctx.needsPickup} hotelBooked=${ctx.hotelBooked} addons=${ctx.hadServiceAddons}`
}

// ─── EQUIVALENCE: forward routing ───────────────────────────────────────────

describe('legacy-plan ≡ current routing — stepAfterAccommodation (all permutations)', () => {
  it('matches the forward-routing oracle for every hotel_offering × needs_pickup × hotel-booked', () => {
    for (const ctx of permutations()) {
      const product = makeProduct({
        hotel_offering: ctx.offering,
        needs_pickup: ctx.needsPickup,
      })
      const next = stepAfterAccommodation(
        product,
        SLOT_SELECTION,
        ADA,
        makeParticipants(2),
        NO_COMPANIONS,
        ctx.hotelBooked ? [{ productId: 'room-1', quantity: 1 }] : [],
        hotelLocId(ctx),
      )
      expect(next.name, permLabel(ctx)).toBe(oracleStepAfterAccommodation(ctx))
      // When a hotel was booked, the hotel must be locked in as the pickup.
      if (ctx.hotelBooked && next.name === 'fill-form') {
        expect(next.pickupLocationId, permLabel(ctx)).toBe('loc-hotel')
      }
      // When no hotel + no pickup, fill-form's pickup must be null.
      if (!ctx.hotelBooked && !ctx.needsPickup && next.name === 'fill-form') {
        expect(next.pickupLocationId, permLabel(ctx)).toBeNull()
      }
    }
  })
})

// ─── EQUIVALENCE: back-from-review routing ──────────────────────────────────

describe('legacy-plan ≡ current routing — stepBeforeReview (all permutations)', () => {
  it('matches the back-routing oracle for every permutation', () => {
    for (const ctx of permutations()) {
      const prev = stepBeforeReview(reviewArgs(ctx))
      expect(prev.name, permLabel(ctx)).toBe(oracleStepBeforeReview(ctx))
    }
  })
})

// ─── EQUIVALENCE: breadcrumb trails ─────────────────────────────────────────

/**
 * ORACLE for the breadcrumb trail names, from the funnel entry to the review
 * terminus, per the documented routing. This independently reconstructs the
 * chain the OLD code produced.
 */
function oracleBreadcrumb(ctx: FunnelCtx, requiresDeclarations: boolean): string[] {
  const trail: string[] = ['product-detail', 'pick-selection', 'details']
  if (offeringHasHotel(ctx.offering)) {
    // A hotel-offering product collapses the accommodation+pickup branch onto
    // the accommodation crumb (the long-standing landr-87n9.1 back-from-review
    // contract reconstructs the trail via stepBeforeReview, which routes a
    // hotel-offering product straight to accommodation). So pickup NEVER appears
    // in the breadcrumb for a hotel-offering product — even on the guiding-only
    // opt-out that forward-routed through the pickup picker. This asymmetry is
    // exactly today's behaviour and the equivalence net pins it.
    trail.push('pick-accommodation')
  } else {
    // No hotel offering: service add-ons (if shown) then pickup (if needed).
    if (ctx.hadServiceAddons) trail.push('pick-service-addons')
    if (ctx.needsPickup) trail.push('pick-pickup')
  }
  if (requiresDeclarations) trail.push('declarations')
  trail.push('fill-form')
  return trail
}

describe('legacy-plan ≡ current routing — breadcrumb trail (all permutations × declarations)', () => {
  it('matches the breadcrumb oracle for every permutation', () => {
    for (const ctx of permutations()) {
      for (const requiresDeclarations of REQUIRES_DECLARATIONS) {
        const fillForm: Step = {
          name: 'fill-form',
          product: makeProduct({
            hotel_offering: ctx.offering,
            needs_pickup: ctx.needsPickup,
          }),
          selection: SLOT_SELECTION,
          booker: ADA,
          participants: makeParticipants(2),
          companions: NO_COMPANIONS,
          pickupLocationId: ctx.hotelBooked ? 'loc-hotel' : 'loc-free',
          accommodationRooms: ctx.hotelBooked
            ? [{ productId: 'room-1', quantity: 1 }]
            : [],
          addons: ctx.hadServiceAddons
            ? [{ productId: 'addon-1', quantity: 1 }]
            : [],
          hotelLocationId: hotelLocId(ctx),
          hadServiceAddons: ctx.hadServiceAddons,
        }
        const crumbs = buildBreadcrumb(fillForm, { requiresDeclarations })
        const label = `${permLabel(ctx)} decl=${requiresDeclarations}`
        expect(crumbs.map((c) => c.name), label).toEqual(
          oracleBreadcrumb(ctx, requiresDeclarations),
        )
      }
    }
  })
})

// ─── EQUIVALENCE: back-walk one-step (stepBefore) consistency ───────────────

describe('legacy-plan ≡ current routing — stepBefore mirrors the trail (all permutations)', () => {
  it('each crumb target equals the step one back from the next crumb', () => {
    for (const ctx of permutations()) {
      const fillForm: Step = {
        name: 'fill-form',
        product: makeProduct({
          hotel_offering: ctx.offering,
          needs_pickup: ctx.needsPickup,
        }),
        selection: SLOT_SELECTION,
        booker: ADA,
        participants: makeParticipants(2),
        companions: NO_COMPANIONS,
        pickupLocationId: ctx.hotelBooked ? 'loc-hotel' : 'loc-free',
        accommodationRooms: ctx.hotelBooked
          ? [{ productId: 'room-1', quantity: 1 }]
          : [],
        addons: ctx.hadServiceAddons ? [{ productId: 'addon-1', quantity: 1 }] : [],
        hotelLocationId: hotelLocId(ctx),
        hadServiceAddons: ctx.hadServiceAddons,
      }
      // stepBefore from fill-form (no declarations) must equal the back-review
      // oracle.
      const prev = stepBefore(fillForm, { requiresDeclarations: false })
      expect(prev?.name, permLabel(ctx)).toBe(oracleStepBeforeReview(ctx))
    }
  })
})

// ─── buildFlowPlan: legacy plan structure ───────────────────────────────────

describe('buildFlowPlan — legacy plan (remoteFlow === null)', () => {
  function kinds(plan: FlowModule[]): string[] {
    return plan.map((m) => m.kind)
  }

  it('plain product: selection → participants → service_addons → review', () => {
    const plan = buildFlowPlan(makeProduct(), {}, null)
    expect(kinds(plan)).toEqual([
      'selection',
      'participants',
      'service_addons',
      'review',
    ])
  })

  it('inserts accommodation iff the product offers a hotel', () => {
    expect(kinds(buildFlowPlan(makeProduct({ hotel_offering: 'optional' }), {}, null))).toContain(
      'accommodation',
    )
    expect(kinds(buildFlowPlan(makeProduct({ hotel_offering: 'mandatory' }), {}, null))).toContain(
      'accommodation',
    )
    expect(
      kinds(buildFlowPlan(makeProduct({ hotel_offering: 'none' }), {}, null)),
    ).not.toContain('accommodation')
  })

  it('accommodation is gated on product_kind=service (non-service never gets it)', () => {
    const plan = buildFlowPlan(
      makeProduct({ product_kind: 'digital_good', hotel_offering: 'optional' }),
      {},
      null,
    )
    expect(kinds(plan)).not.toContain('accommodation')
  })

  it('inserts pickup iff needs_pickup', () => {
    expect(kinds(buildFlowPlan(makeProduct({ needs_pickup: true }), {}, null))).toContain('pickup')
    expect(
      kinds(buildFlowPlan(makeProduct({ needs_pickup: false }), {}, null)),
    ).not.toContain('pickup')
  })

  it('inserts declarations iff the operator slug requires them (legacy hardcoded set)', () => {
    expect(kinds(buildFlowPlan(makeProduct(), { slug: 'para42' }, null))).toContain('declarations')
    expect(
      kinds(buildFlowPlan(makeProduct(), { slug: 'someone-else' }, null)),
    ).not.toContain('declarations')
    // The para42-dev-* test slugs must NOT match (exact-match gate).
    expect(
      kinds(buildFlowPlan(makeProduct(), { slug: 'para42-dev-1' }, null)),
    ).not.toContain('declarations')
  })

  it('full-featured product: order is selection, participants, accommodation, service_addons, pickup, declarations, review', () => {
    const plan = buildFlowPlan(
      makeProduct({ hotel_offering: 'optional', needs_pickup: true }),
      { slug: 'para42' },
      null,
    )
    expect(kinds(plan)).toEqual([
      'selection',
      'participants',
      'accommodation',
      'service_addons',
      'pickup',
      'declarations',
      'review',
    ])
  })
})

// ─── buildFlowPlan: tolerant parsing (NEVER throw — landr-9ut4) ──────────────

describe('buildFlowPlan — tolerant parse (malformed remoteFlow → legacy, never throws)', () => {
  const legacy = buildFlowPlan(
    makeProduct({ hotel_offering: 'optional', needs_pickup: true }),
    { slug: 'para42' },
    null,
  )
  function product() {
    return makeProduct({ hotel_offering: 'optional', needs_pickup: true })
  }
  function build(remote: unknown): FlowModule[] {
    // The signature is permissive at the call boundary on purpose — the wire
    // payload is untyped. Cast through unknown so the test can shove garbage in.
    return buildFlowPlan(product(), { slug: 'para42' }, remote as never)
  }

  it('null → legacy plan', () => {
    expect(build(null)).toEqual(legacy)
  })

  it('{modules: null} → legacy plan', () => {
    expect(build({ modules: null })).toEqual(legacy)
  })

  it('modules not an array → legacy plan', () => {
    expect(build({ modules: 'oops' })).toEqual(legacy)
    expect(build({ modules: 42 })).toEqual(legacy)
    expect(build({ modules: { 0: 'x' } })).toEqual(legacy)
  })

  it('a non-object remoteFlow → legacy plan (no throw)', () => {
    expect(build('garbage')).toEqual(legacy)
    expect(build(123)).toEqual(legacy)
    expect(build(true)).toEqual(legacy)
  })

  it('modules array full of garbage entries → legacy plan (every entry unparseable)', () => {
    expect(build({ modules: [null, 1, 'x', {}, { kind: 'nope' }] })).toEqual(legacy)
  })

  it('NEVER throws across a battery of hostile inputs', () => {
    const hostile: unknown[] = [
      undefined,
      null,
      0,
      '',
      NaN,
      [],
      {},
      { modules: undefined },
      { modules: [undefined] },
      { modules: [{ kind: 123 }] },
      { modules: [{ kind: 'custom_form' }] }, // missing form key
      { modules: [{ kind: 'custom_form', form: {} }] },
      { modules: [{ kind: 'custom_form', form: { key: 99 } }] },
      Symbol('x') as unknown,
      (() => {}) as unknown,
    ]
    for (const h of hostile) {
      expect(() => build(h)).not.toThrow()
      // And whatever comes back is always a valid, non-empty plan ending in review.
      const plan = build(h)
      expect(plan.length).toBeGreaterThan(0)
      expect(plan.at(-1)!.kind).toBe('review')
      expect(plan[0]!.kind).toBe('selection')
    }
  })
})

// ─── buildFlowPlan: remote-flow happy path ──────────────────────────────────

describe('buildFlowPlan — well-formed remoteFlow overrides the order', () => {
  function product() {
    return makeProduct({ hotel_offering: 'optional', needs_pickup: true })
  }

  it('honours the remote module order, framed by selection/participants…review', () => {
    const plan = buildFlowPlan(product(), {}, {
      modules: [
        { kind: 'pickup', position: 0 },
        { kind: 'accommodation', position: 1 },
        { kind: 'custom_form', position: 2, form: { key: 'waiver' } },
      ],
    })
    expect(plan.map((m) => m.kind)).toEqual([
      'selection',
      'participants',
      'pickup',
      'accommodation',
      'custom_form',
      'review',
    ])
    const cf = plan.find((m) => m.kind === 'custom_form')!
    expect(cf.formKey).toBe('waiver')
  })

  it('accepts the flat form_key shape too', () => {
    const plan = buildFlowPlan(product(), {}, {
      modules: [{ kind: 'custom_form', form_key: 'health' }],
    })
    expect(plan.find((m) => m.kind === 'custom_form')!.formKey).toBe('health')
  })

  it('drops accommodation from a remote flow when the product offers no hotel', () => {
    const plan = buildFlowPlan(makeProduct({ hotel_offering: 'none' }), {}, {
      modules: [{ kind: 'accommodation' }, { kind: 'custom_form', form: { key: 'q1' } }],
    })
    expect(plan.map((m) => m.kind)).toEqual([
      'selection',
      'participants',
      'custom_form',
      'review',
    ])
  })

  it('skips unknown module kinds silently (forward-compat)', () => {
    const plan = buildFlowPlan(product(), {}, {
      modules: [
        { kind: 'future_kind_xyz' },
        { kind: 'pickup' },
        { kind: 'another_unknown' },
      ],
    })
    expect(plan.map((m) => m.kind)).toEqual([
      'selection',
      'participants',
      'pickup',
      'review',
    ])
  })

  it('an explicitly empty modules array is a valid minimal flow (selection → participants → review)', () => {
    const plan = buildFlowPlan(product(), {}, { modules: [] })
    expect(plan.map((m) => m.kind)).toEqual([
      'selection',
      'participants',
      'review',
    ])
  })

  it('does NOT inject the legacy declarations step on the remote path', () => {
    const plan = buildFlowPlan(product(), { slug: 'para42' }, {
      modules: [{ kind: 'pickup' }],
    })
    expect(plan.map((m) => m.kind)).not.toContain('declarations')
  })
})
