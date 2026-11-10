import { describe, expect, it } from 'vitest'
import type { EvaluatedLine, EvaluatedOffer } from '@/api/types'
import {
  addPick,
  cartTree,
  clampOfferQty,
  clampRoomStepperQty,
  isRoomStepperOffer,
  settleRoomStepperPicks,
  depthOf,
  effectiveSchedule,
  evaluateLines,
  extraOfferEstimateLines,
  guestsWire,
  instantGate,
  lineDays,
  lineIsStay,
  MAIN_LINE_ID,
  mainEstimateLines,
  MAX_EVALUATE_LINES,
  newPick,
  nextLineId,
  partyMembers,
  picksBlocking,
  priceLabel,
  reasonText,
  reconcile,
  removeLine,
  roomExtraQty,
  roomLineId,
  seedMandatory,
  setOption,
  setQuantity,
  togglePerson,
  toggleSubsetDay,
  toEstimateLines,
  toProductLines,
  type OfferPick,
  type OfferTreeInput,
} from './offerCart'

const STAY = 'stay-1'
const DAYS = ['2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04']

function offer(id: string, over: Partial<EvaluatedOffer> = {}): EvaluatedOffer {
  return {
    id,
    parent_product_id: STAY,
    product_id: `p-${id}`,
    rules: { mode: 'all', items: [] },
    binding: 'booking',
    schedule: 'locked',
    collection: 'online',
    mode: 'optional',
    options: [],
    min_qty: 0,
    max_qty: null,
    sort_order: 0,
    name: id,
    product_kind: 'service',
    in_cart: false,
    draft: false,
    ...over,
  }
}

const tree: OfferTreeInput = {
  main: { lineId: MAIN_LINE_ID, productId: STAY, parentLineId: null, days: DAYS },
}

const members = partyMembers(
  [
    { id: 'm-ada', first_name: 'Ada', guest_attributes: {} },
    { id: 'm-bob', first_name: 'Bob' },
  ],
  [{ id: 'm-kid', first_name: 'Kid', occupant_age_band: 'child', occupant_age: 8 }],
)

function verdict(lineId: string, offers: EvaluatedOffer[], eligible = true): EvaluatedLine {
  return { line_id: lineId, eligible, offers, draft: false }
}

describe('party members', () => {
  it('names guests g1..gN in party order, ages from the occupant age', () => {
    expect(members.map((m) => m.ref)).toEqual(['g1', 'g2', 'g3'])
    expect(members.map((m) => m.key)).toEqual(['m-ada', 'm-bob', 'm-kid'])
    expect(members[2]!.attributes.age).toBe(8)
    expect(members[0]!.attributes.age).toBeUndefined()
  })

  it('takes the age map (RoomAssignment) over nothing, never over an answered age', () => {
    const ms = partyMembers(
      [{ id: 'a', guest_attributes: { age: 40 } }, { id: 'b' }],
      [],
      { 0: { band: 'child', age: 3 }, 1: { band: 'child', age: 5 } },
    )
    expect(ms.map((m) => m.attributes.age)).toEqual([40, 5])
  })

  it('keeps member keys stable when the roster is reordered', () => {
    const swapped = partyMembers([{ id: 'm-bob' }, { id: 'm-ada' }], [])
    expect(swapped.find((m) => m.key === 'm-ada')!.ref).toBe('g2')
  })

  it('wires guests as {id: ref, attributes}', () => {
    expect(guestsWire(members)[2]).toEqual({ id: 'g3', attributes: { age: 8 } })
  })
})

describe('schedules', () => {
  it('reads a legacy day-pickable locked row as subset', () => {
    expect(effectiveSchedule({ schedule: 'locked', day_selection: 'parent_subset' })).toBe('subset')
    expect(effectiveSchedule({ schedule: 'locked', day_selection: 'parent_all' })).toBe('locked')
    expect(effectiveSchedule({ schedule: 'own' })).toBe('own')
  })

  it('a subset pick starts on every parent day and never goes empty', () => {
    const ac = offer('ac', { schedule: 'subset' })
    let picks = [newPick(ac, MAIN_LINE_ID, 'o1', DAYS)]
    expect(picks[0]!.days).toEqual(DAYS)
    picks = toggleSubsetDay(picks, 'o1', DAYS[1]!, DAYS)
    expect(picks[0]!.days).toEqual([DAYS[0], DAYS[2], DAYS[3]])
    picks = toggleSubsetDay(picks, 'o1', '2030-01-01', DAYS)
    expect(picks[0]!.days).toHaveLength(3)
    for (const d of [DAYS[0], DAYS[2]]) picks = toggleSubsetDay(picks, 'o1', d!, DAYS)
    expect(picks[0]!.days).toEqual([DAYS[3]])
    picks = toggleSubsetDay(picks, 'o1', DAYS[3]!, DAYS)
    expect(picks[0]!.days).toEqual([DAYS[3]])
  })

  it('locked lines take the parent days, subset the picked ones, rooms their nights', () => {
    const rooms = cartTree({ product_id: STAY }, DAYS, [{ productId: 'room-a', quantity: 1 }])
    expect(rooms.rooms![0]!.lineId).toBe(roomLineId('room-a'))
    expect(rooms.rooms![0]!.days.length).toBeGreaterThan(0)
    const picks: OfferPick[] = [
      newPick(offer('bed'), MAIN_LINE_ID, 'o1', DAYS),
      { ...newPick(offer('ac', { schedule: 'subset' }), MAIN_LINE_ID, 'o2', DAYS), days: [DAYS[0]!] },
      newPick(offer('bf', { parent_product_id: 'room-a' }), roomLineId('room-a'), 'a1', []),
    ]
    const lines = toProductLines(picks, rooms, members)
    expect(lines.find((l) => l.line_id === 'o1')!.selected_days).toEqual(DAYS)
    expect(lines.find((l) => l.line_id === 'o2')!.selected_days).toEqual([DAYS[0]])
    expect(lines.find((l) => l.line_id === 'a1')!.selected_days).toEqual(rooms.rooms![0]!.days)
  })
})

describe('cart operations', () => {
  it('a person pick sends one qty-1 line per ticked guest, distinct refs, short ids', () => {
    const cot = offer('cot', { binding: 'person', collection: 'free' })
    let picks: OfferPick[] = [{ ...newPick(cot, MAIN_LINE_ID, 'o3', DAYS), memberIds: ['m-ada'] }]
    picks = togglePerson(picks, 'o3', 'm-bob')
    picks = togglePerson(picks, 'o3', 'm-kid')
    const lines = toProductLines(picks, tree, members)
    expect(lines.map((l) => [l.line_id, l.participant_id, l.quantity])).toEqual([
      ['o3', 'g1', 1],
      ['o3-g2', 'g2', 1],
      ['o3-g3', 'g3', 1],
    ])
    for (const l of lines) expect(l.line_id!.length).toBeLessThanOrEqual(40)
    expect(lines.every((l) => l.parent_line_id === MAIN_LINE_ID && l.offer_id === 'cot')).toBe(true)
  })

  it('unticking the last guest removes an optional pick, never a mandatory one', () => {
    const o = offer('x', { binding: 'person' })
    const one = [{ ...newPick(o, MAIN_LINE_ID, 'o1', DAYS), memberIds: ['m-ada'] }]
    expect(togglePerson(one, 'o1', 'm-ada')).toEqual([])
    const mand = [{ ...newPick({ ...o, mode: 'mandatory' }, MAIN_LINE_ID, 'o1', DAYS), memberIds: ['m-ada'] }]
    expect(togglePerson(mand, 'o1', 'm-ada')).toHaveLength(1)
  })

  it('clamps a free quantity to min..max and the stock', () => {
    expect(clampOfferQty({ min_qty: 2, max_qty: 5, stock: null }, 1)).toBe(2)
    expect(clampOfferQty({ min_qty: 0, max_qty: 5, stock: null }, 9)).toBe(5)
    expect(clampOfferQty({ min_qty: 0, max_qty: null, stock: { available: true, stock_remaining: 3 } }, 9)).toBe(3)
    expect(clampOfferQty({ min_qty: 0, max_qty: null, stock: null }, 0)).toBe(0)
    const garage = offer('g', { binding: 'free', max_qty: 2 })
    let picks = [newPick(garage, MAIN_LINE_ID, 'o1', DAYS)]
    expect(picks[0]!.quantity).toBe(1)
    picks = setQuantity(picks, 'o1', 7)
    expect(picks[0]!.quantity).toBe(2)
    expect(setQuantity(picks, 'o1', 0)).toEqual([])
  })

  it('a booking pick is one line of 1 with its option', () => {
    const o = offer('shuttle', { options: [{ key: 'one_way', label: 'One way', price_delta_cents: 500 }] })
    let picks = [newPick(o, MAIN_LINE_ID, 'o1', DAYS)]
    expect(picksBlocking(picks)).toBe(true)
    picks = setOption(picks, 'o1', '*', 'one_way')
    expect(picksBlocking(picks)).toBe(false)
    expect(toProductLines(picks, tree, members)).toEqual([
      {
        product_id: 'p-shuttle',
        quantity: 1,
        line_id: 'o1',
        parent_line_id: MAIN_LINE_ID,
        offer_id: 'shuttle',
        option_key: 'one_way',
        selected_days: DAYS,
      },
    ])
  })

  it('removing a line removes everything under it, three deep', () => {
    const picks: OfferPick[] = [
      newPick(offer('tour'), MAIN_LINE_ID, 'o1', DAYS),
      newPick(offer('shoes', { parent_product_id: 'p-tour' }), 'o1', 'o2', DAYS),
      newPick(offer('socks', { parent_product_id: 'p-shoes' }), 'o2', 'o3', DAYS),
      newPick(offer('bed'), MAIN_LINE_ID, 'o4', DAYS),
    ]
    expect(removeLine(picks, 'o1').map((p) => p.lineId)).toEqual(['o4'])
  })

  it('refuses a pick deeper than 3 and the same offer twice under one parent', () => {
    let picks: OfferPick[] = []
    picks = addPick(picks, newPick(offer('a'), MAIN_LINE_ID, 'o1', DAYS), tree)
    picks = addPick(picks, newPick(offer('b'), 'o1', 'o2', DAYS), tree)
    picks = addPick(picks, newPick(offer('c'), 'o2', 'o3', DAYS), tree)
    expect(depthOf('o3', tree, picks)).toBe(3)
    expect(addPick(picks, newPick(offer('d'), 'o3', 'o4', DAYS), tree)).toBe(picks)
    expect(addPick(picks, newPick(offer('a'), MAIN_LINE_ID, 'o9', DAYS), tree)).toBe(picks)
  })

  it('mints the next free id per prefix', () => {
    expect(nextLineId('o', ['main', 'o1', 'o7', 'a3', 'o7-g2'])).toBe('o8')
    expect(nextLineId('a', ['o1'])).toBe('a1')
  })

  it('folds room-type picks to {room: {product: qty}}', () => {
    const picks: OfferPick[] = [
      { ...newPick(offer('bf', { binding: 'free' }), roomLineId('r1'), 'a1', []), quantity: 2 },
      { ...newPick(offer('tw', { binding: 'person' }), roomLineId('r1'), 'a2', []), memberIds: ['x', 'y'] },
      newPick(offer('bed'), MAIN_LINE_ID, 'o1', DAYS),
    ]
    expect(roomExtraQty(picks)).toEqual({ r1: { 'p-bf': 2, 'p-tw': 2 } })
  })
})

describe('wire allow-list', () => {
  it('never sends a price, collection, mode, schedule or binding', () => {
    const o = offer('tax', { collection: 'on_site', mode: 'mandatory', binding: 'free' })
    const picks = [newPick(o, MAIN_LINE_ID, 'o1', DAYS)]
    for (const line of [...toProductLines(picks, tree, members), ...toEstimateLines(picks, tree, members)]) {
      for (const k of ['price', 'collection', 'mode', 'schedule', 'binding', 'unit_price', 'line_total']) {
        expect(line).not.toHaveProperty(k)
      }
    }
  })

  it('skips info and server-attached picks', () => {
    const tax = offer('tax', { binding: 'person', mode: 'mandatory', server_attached: true })
    const picks = [{ ...newPick(tax, MAIN_LINE_ID, 'o1', DAYS), memberIds: ['m-ada'] }]
    expect(toProductLines(picks, tree, members)).toEqual([])
    const migrated = [{ ...picks[0]!, seen: { ...tax, server_attached: false } }]
    expect(toProductLines(migrated, tree, members)).toHaveLength(1)
  })

  it('prices picks under an added product on its own estimate', () => {
    const t: OfferTreeInput = {
      ...tree,
      extras: [{ lineId: 'o1', productId: 'tour', parentLineId: MAIN_LINE_ID, days: [DAYS[0]!] }],
    }
    const picks = [
      newPick(offer('shoes', { parent_product_id: 'tour' }), 'o1', 'o2', [DAYS[0]!]),
      newPick(offer('bed'), MAIN_LINE_ID, 'o3', DAYS),
    ]
    expect(mainEstimateLines(picks, t, members).map((l) => l.line_id)).toEqual(['o3'])
    expect(extraOfferEstimateLines('o1', picks, t, members)).toEqual([
      expect.objectContaining({ line_id: 'o2', parent_line_id: MAIN_LINE_ID }),
    ])
  })

  it('caps the evaluate request at 20 lines, deepest picks first to go', () => {
    const picks: OfferPick[] = []
    for (let i = 1; i <= 25; i += 1) picks.push(newPick(offer(`x${i}`), MAIN_LINE_ID, `o${i}`, DAYS))
    picks.push(newPick(offer('deep'), 'o1', 'o99', DAYS))
    const lines = evaluateLines(tree, picks)
    expect(lines).toHaveLength(MAX_EVALUATE_LINES)
    expect(lines[0]!.line_id).toBe(MAIN_LINE_ID)
    expect(lines.some((l) => l.line_id === 'o99')).toBe(false)
  })
})

describe('server-attached person offer with options', () => {
  const opts = [
    { key: 'std', label: 'Standard', price_delta_cents: 0 },
    { key: 'plus', label: 'Plus', price_delta_cents: 150 },
  ]
  const tax = offer('tax', { binding: 'person', mode: 'mandatory', server_attached: true, options: opts })

  it('is seeded for every admitted guest and never blocks Confirm', () => {
    const picks = seedMandatory([], { main: verdict(MAIN_LINE_ID, [tax]) }, tree, members)
    expect(picks.map((p) => p.offerId)).toEqual(['tax'])
    expect(picks[0]!.options).toEqual({})
    expect(picksBlocking(picks)).toBe(false)
    expect(toProductLines(picks, tree, members)).toEqual([])
  })

  it('sends one line only for each guest who chose an option', () => {
    const [seeded] = seedMandatory([], { main: verdict(MAIN_LINE_ID, [tax]) }, tree, members)
    const pick = { ...seeded!, options: { 'm-bob': 'plus' } }
    const lines = toProductLines([pick], tree, members)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ offer_id: 'tax', quantity: 1, option_key: 'plus' })
    expect(lines[0]!.participant_id).toBe(members.find((m) => m.key === 'm-bob')!.ref)
    expect(lines[0]!.line_id).toBe(pick.lineId)
    expect(toEstimateLines([pick], tree, members)).toHaveLength(1)
  })

  it('drops a guest\'s line once their option is cleared', () => {
    const [seeded] = seedMandatory([], { main: verdict(MAIN_LINE_ID, [tax]) }, tree, members)
    const chosen = setOption([seeded!], seeded!.lineId, 'm-bob', 'plus')
    expect(toProductLines(chosen, tree, members)).toHaveLength(1)
    const cleared = setOption(chosen, seeded!.lineId, 'm-bob', '')
    expect(cleared[0]!.options).toEqual({})
    expect(toProductLines(cleared, tree, members)).toEqual([])
  })
})

describe('seedMandatory', () => {
  const tax = offer('tax', { binding: 'person', mode: 'mandatory', server_attached: true })
  const migrated = offer('linen', {
    binding: 'person',
    mode: 'mandatory',
    server_attached: false,
    rules: { mode: 'all', items: [{ cond: 'guest_attr', key: 'age', op: 'gte', value: 10 }] },
    options: [{ key: 'single', label: 'Single', price_delta_cents: 0 }],
  })
  const fee = offer('fee', { mode: 'mandatory', binding: 'free', min_qty: 2 })

  it('skips a server-attached person offer, seeds a migrated one per admitted guest', () => {
    const picks = seedMandatory([], { main: verdict(MAIN_LINE_ID, [tax, migrated, fee]) }, tree, members)
    expect(picks.map((p) => p.offerId)).toEqual(['linen', 'fee'])
    const linen = picks.find((p) => p.offerId === 'linen')!
    // The 8-year-old fails age >= 10; the unanswered adults may still match.
    expect(linen.memberIds).toEqual(['m-ada', 'm-bob'])
    // No option is preselected: each guest chooses (Confirm waits for it).
    expect(linen.options).toEqual({})
    expect(picksBlocking(picks)).toBe(true)
    expect(picks.find((p) => p.offerId === 'fee')!.quantity).toBe(2)
  })

  it('is idempotent and leaves offers already in the cart alone', () => {
    const v = { main: verdict(MAIN_LINE_ID, [fee]) }
    const once = seedMandatory([], v, tree, members)
    expect(seedMandatory(once, v, tree, members)).toEqual(once)
    expect(seedMandatory([], { main: verdict(MAIN_LINE_ID, [{ ...fee, in_cart: true }]) }, tree, members)).toEqual([])
  })
})

describe('reconcile', () => {
  const bed = offer('bed')
  const shoes = offer('shoes', { parent_product_id: 'p-tour' })

  it('drops a vanished offer, an ineligible child, unknown guests, and cascades', () => {
    const picks: OfferPick[] = [
      newPick(bed, MAIN_LINE_ID, 'o1', DAYS),
      newPick(offer('tour'), MAIN_LINE_ID, 'o2', DAYS),
      newPick(shoes, 'o2', 'o3', DAYS),
      { ...newPick(offer('cot', { binding: 'person' }), MAIN_LINE_ID, 'o4', DAYS), memberIds: ['gone'] },
    ]
    const { picks: out, dropped } = reconcile(
      picks,
      {
        main: verdict(MAIN_LINE_ID, [bed, offer('cot', { binding: 'person' })]),
        o2: verdict('o2', [shoes]),
      },
      tree,
      members,
    )
    expect(out.map((p) => p.lineId)).toEqual(['o1'])
    expect(dropped).toBe(3)
    const ineligible = reconcile(
      [newPick(bed, MAIN_LINE_ID, 'o1', DAYS)],
      { main: verdict(MAIN_LINE_ID, [bed]), o1: verdict('o1', [], false) },
      tree,
      members,
    )
    expect(ineligible.picks).toEqual([])
  })

  it('drops a room-type pick once that room type leaves the cart', () => {
    const withRoom = cartTree({ product_id: STAY }, DAYS, [{ productId: 'r1', quantity: 1 }])
    const picks = [newPick(offer('bf', { parent_product_id: 'r1' }), roomLineId('r1'), 'a1', [])]
    expect(reconcile(picks, {}, withRoom, members).picks).toHaveLength(1)
    expect(reconcile(picks, {}, tree, members).picks).toEqual([])
  })

  it('keeps a parent-NULL offer already in the cart by its own verdict', () => {
    const kayak = offer('kayak', { parent_product_id: null, schedule: 'locked' })
    const picks = [newPick(kayak, MAIN_LINE_ID, 'o1', DAYS)]
    const v = { main: verdict(MAIN_LINE_ID, []), o1: verdict('o1', []) }
    expect(reconcile(picks, v, tree, members).picks).toHaveLength(1)
  })

  it('trims picked days to the parent and drops unknown members', () => {
    const ac = offer('ac', { schedule: 'subset' })
    const picks = [{ ...newPick(ac, MAIN_LINE_ID, 'o1', DAYS), days: ['2030-01-01', DAYS[0]!] }]
    expect(reconcile(picks, { main: verdict(MAIN_LINE_ID, [ac]) }, tree, members).picks[0]!.days).toEqual([
      DAYS[0],
    ])
  })
})

describe('display', () => {
  it('reads four price tones', () => {
    expect(priceLabel({ collection: 'free', price_preview: null }, 'en').text).toBe('Free')
    const pv = { quantity: 1, total_cents: 4000, price_unit: 'booking' as const, currency: 'EUR' }
    expect(priceLabel({ collection: 'online', price_preview: pv }, 'en')).toEqual({ text: '€40.00', tone: 'online' })
    expect(priceLabel({ collection: 'on_site', price_preview: { ...pv, total_cents: 2000 } }, 'en')).toEqual({
      text: '€20.00 · Pay on arrival',
      tone: 'on_site',
    })
    expect(priceLabel({ collection: 'online', price_preview: null }, 'en').tone).toBe('tbd')
  })

  it('says why a line cannot be booked', () => {
    expect(reasonText('guest_attr_all.age', { op: 'gte', value: 10 }, 'en')).toBe('No guests under 10')
    expect(reasonText('guest_attr_all.age', { op: 'gte', value: 10 }, 'de')).toBe('Keine Gäste unter 10')
    expect(reasonText('guest_attr_all.age', { op: 'lte', value: 12 }, 'en')).toBe('Only for guests up to 12')
    expect(reasonText('guest_attr_all.age', { op: 'between', value: [3, 11] }, 'en')).toBe(
      'Only for guests aged 3 to 11',
    )
    // "Some guest" rules read differently from "every guest" ones.
    expect(reasonText('guest_attr.age', { op: 'gte', value: 18 }, 'en')).toBe('At least one guest must be 18 or older')
    expect(reasonText('guest_attr.age', { op: 'lte', value: 2 }, 'de')).toBe('Mindestens ein Gast muss 2 Jahre oder jünger sein')
    expect(reasonText('guest_attr.age', { op: 'between', value: [3, 11] }, 'en')).toBe(
      'At least one guest must be aged 3 to 11',
    )
    expect(reasonText('guest_attr_all.age', null, 'en')).toBe('Not available for the ages in your party')
    expect(reasonText('attribute_missing.age', null, 'en')).toBe('Please answer the guest questions first')
    expect(reasonText('date_window', null, 'en')).toBe('Not available on your dates')
    expect(reasonText('stay_nights', null, 'en')).toBe('Not available for this number of nights')
    expect(reasonText('parent_unavailable', null, 'en')).toBe('Sold out for your dates')
    expect(reasonText('no_rule_matched', null, 'en')).toBe('Not available for your booking')
  })

  it('gates instantly on what the party plainly fails, never on what it may still answer', () => {
    const rules = { mode: 'all', items: [{ cond: 'guest_attr_all', key: 'age', op: 'gte', value: 10 }] }
    expect(instantGate(rules, members)).toBe(false) // the 8-year-old answered
    expect(instantGate(rules, members.slice(0, 2))).toBe(true) // nobody answered yet
    expect(instantGate({ mode: 'any', items: [] }, members)).toBe(true)
    expect(instantGate(null, members)).toBe(true)
  })
})

describe('review fixes', () => {
  it('reads the server effective schedule over the inference', () => {
    expect(effectiveSchedule({ schedule: 'locked', day_selection: 'parent_subset', effective_schedule: 'locked' })).toBe('locked')
    expect(effectiveSchedule({ schedule: 'locked', effective_schedule: 'subset' })).toBe('subset')
  })

  it('sends one line per guest when the API does not say server_attached', () => {
    const o = offer('linen', { binding: 'person', mode: 'mandatory' })
    delete (o as Partial<EvaluatedOffer>).server_attached
    const picks = seedMandatory([], { main: verdict(MAIN_LINE_ID, [o]) }, tree, members)
    expect(toProductLines(picks, tree, members)).toHaveLength(3)
  })

  it('a mandatory per-person pick follows the party: 3 guests then 4', () => {
    const linen = offer('linen', { binding: 'person', mode: 'mandatory', server_attached: false })
    const v = { main: verdict(MAIN_LINE_ID, [linen]) }
    let picks = seedMandatory([], v, tree, members)
    expect(toProductLines(picks, tree, members)).toHaveLength(3)
    const four = partyMembers(
      [{ id: 'm-ada' }, { id: 'm-bob' }],
      [{ id: 'm-kid', occupant_age_band: 'child', occupant_age: 8 }, { id: 'm-new' }],
    )
    picks = reconcile(picks, v, tree, four).picks
    expect(toProductLines(picks, tree, four).map((l) => l.participant_id)).toEqual(['g1', 'g2', 'g3', 'g4'])
  })

  it('finds the added products hung off a pick that went, and their own', async () => {
    const { orphanExtraKeys } = await import('./offerCart')
    const extra = (key: string, lineId: string, parentLineId: string) =>
      ({ key, lineId, parentLineId, offerId: 'x', product: { product_id: key } }) as never
    const extras = [extra('tour', 'o2', 'o1'), extra('shoes', 'o3', 'o2'), extra('kayak', 'o4', MAIN_LINE_ID)]
    const withPick = [newPick(offer('pass'), MAIN_LINE_ID, 'o1', DAYS)]
    expect([...orphanExtraKeys(extras, tree, withPick)]).toEqual([])
    expect([...orphanExtraKeys(extras, tree, [])].sort()).toEqual(['shoes', 'tour'])
  })
})

describe('one-day schedules (first_day / last_day)', () => {
  const stayTree: OfferTreeInput = {
    main: { lineId: MAIN_LINE_ID, productId: STAY, parentLineId: null, days: DAYS, isStay: true },
  }
  const activityTree: OfferTreeInput = {
    main: { lineId: MAIN_LINE_ID, productId: STAY, parentLineId: null, days: DAYS },
  }
  const pickOf = (schedule: 'first_day' | 'last_day', tree: OfferTreeInput) => {
    const o = offer(schedule, { schedule })
    return newPick(o, tree.main.lineId, 'o1', DAYS)
  }

  it('carries no days of its own', () => {
    expect(pickOf('first_day', stayTree).days).toEqual([])
    expect(pickOf('last_day', stayTree).schedule).toBe('last_day')
  })

  it('stay parent: arrival is the first night, departure the last night plus one', () => {
    expect(lineDays('o1', stayTree, [pickOf('first_day', stayTree)])).toEqual(['2027-05-01'])
    expect(lineDays('o1', stayTree, [pickOf('last_day', stayTree)])).toEqual(['2027-05-05'])
  })

  it('departure rolls over a month end', () => {
    const tree: OfferTreeInput = {
      main: { ...stayTree.main, days: ['2027-05-30', '2027-05-31'] },
    }
    expect(lineDays('o1', tree, [pickOf('last_day', tree)])).toEqual(['2027-06-01'])
  })

  it('non-stay parent: its first / last day', () => {
    expect(lineDays('o1', activityTree, [pickOf('first_day', activityTree)])).toEqual(['2027-05-01'])
    expect(lineDays('o1', activityTree, [pickOf('last_day', activityTree)])).toEqual(['2027-05-04'])
  })

  it('ignores the order of the parent days', () => {
    const tree: OfferTreeInput = { main: { ...activityTree.main, days: [...DAYS].reverse() } }
    expect(lineDays('o1', tree, [pickOf('last_day', tree)])).toEqual(['2027-05-04'])
  })

  it('sends the single day on the wire', () => {
    const lines = evaluateLines(stayTree, [pickOf('last_day', stayTree)])
    expect(lines.find((l) => l.line_id === 'o1')?.selected_days).toEqual(['2027-05-05'])
  })

  it('cartTree marks rooms and a stay main as stays', () => {
    const t = cartTree({ product_id: 'p', product_kind: 'stay' }, DAYS, [
      { productId: 'r1', quantity: 1 } as never,
    ])
    expect(t.main.isStay).toBe(true)
    expect(t.rooms?.[0]?.isStay).toBe(true)
    expect(cartTree({ product_id: 'p' }, DAYS).main.isStay).toBe(false)
    expect(lineIsStay('main', stayTree, [])).toBe(true)
    expect(lineIsStay('main', activityTree, [])).toBe(false)
  })

  it('resolves a stay-kind parent pick from its offer', () => {
    const parent = newPick(offer('p', { product_kind: 'stay' }), MAIN_LINE_ID, 'o1', DAYS)
    const child = { ...newPick(offer('c', { schedule: 'last_day' }), 'o1', 'o2', DAYS) }
    expect(lineDays('o2', activityTree, [parent, child])).toEqual(['2027-05-05'])
  })
})

describe('room stepper picks (landr-ey8fx)', () => {
  const bf = offer('bf', { binding: 'person' })
  const stepper = (quantity: number, memberIds: string[] = []) => ({
    ...newPick(bf, 'r-r1', 'a1', DAYS),
    quantity,
    memberIds,
  })
  const members = [
    { key: 'm1', ref: 'g1', name: 'A', attributes: {} },
    { key: 'm2', ref: 'g2', name: 'B', attributes: {} },
  ]

  it('counts the stepper quantity of a fresh pick', () => {
    expect(roomExtraQty([stepper(2)])).toEqual({ r1: { 'p-bf': 2 } })
  })

  it('clamps quantity (and named guests) to the room cap', () => {
    const [p] = clampRoomStepperQty([stepper(2, ['m1', 'm2'])], { r1: 1 })
    expect(p).toMatchObject({ quantity: 1, memberIds: ['m1'] })
    const same = [stepper(1)]
    expect(clampRoomStepperQty(same, { r1: 2 })).toBe(same)
  })

  it('names the chip holders, else the first guests', () => {
    expect(settleRoomStepperPicks([stepper(1)], { r1: ['m2'] }, members)[0]).toMatchObject({ memberIds: ['m2'], quantity: 1 })
    expect(settleRoomStepperPicks([stepper(2)], {}, members)[0]).toMatchObject({ memberIds: ['m1', 'm2'], quantity: 2 })
    const settled = [stepper(1, ['m2'])]
    expect(settleRoomStepperPicks(settled, { r1: ['m2'] }, members)).toBe(settled)
  })

  it('does not treat a person offer with options or under a non-room parent as a stepper', () => {
    expect(isRoomStepperOffer(bf, 'r-r1')).toBe(true)
    expect(isRoomStepperOffer(bf, 'main')).toBe(false)
    expect(isRoomStepperOffer({ ...bf, options: [{ key: 'k', label: 'K', price_delta_cents: 0 }] }, 'r-r1')).toBe(false)
    expect(isRoomStepperOffer({ ...bf, mode: 'mandatory' }, 'r-r1')).toBe(false)
  })

  it('priceLabel quotes the unit price when asked', () => {
    const o = {
      collection: 'online' as const,
      price_preview: { quantity: 1, unit_price_cents: 1200, total_cents: 9600, price_unit: 'guest_night' as const, currency: 'EUR' },
    }
    expect(priceLabel(o, 'en', undefined, 'EUR', true).text).toMatch(/12[.,]00.*guest/)
    expect(priceLabel(o, 'en', undefined, 'EUR').text).toMatch(/96[.,]00/)
  })
})
