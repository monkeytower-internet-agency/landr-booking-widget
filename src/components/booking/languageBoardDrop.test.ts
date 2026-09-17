/**
 * landr-jr30v — pure routing tests for the language board's drop/tap logic.
 *
 * jsdom cannot resolve a real dnd-kit pointer/touch drag (no layout), so a
 * real drag-onto-a-closed-flag interaction is not exercised end-to-end here
 * (see LanguageStep.test.tsx's header comment). These tests instead cover
 * the pure ROUTING decisions directly, which is where the new branching
 * actually lives.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveChipDrop,
  resolveFlagTap,
  UNASSIGNED_DROP_ID,
} from './languageBoardDrop'

describe('resolveChipDrop', () => {
  it('assigns the dragged member when dropped on an OPEN column', () => {
    expect(resolveChipDrop(2, 'lang-es', 'es')).toEqual({
      type: 'assign',
      memberIndex: 2,
      code: 'es',
    })
  })

  it('assigns the dragged member — and ONLY them — when dropped on a CLOSED flag chip', () => {
    // Same shape as an open column: a drag never moves the whole party, that
    // shortcut is tap-only (see resolveFlagTap).
    expect(resolveChipDrop(0, 'lang-add-fr', 'fr')).toEqual({
      type: 'assign',
      memberIndex: 0,
      code: 'fr',
    })
  })

  it('unassigns when dropped on the unassigned tray', () => {
    expect(resolveChipDrop(1, UNASSIGNED_DROP_ID, undefined)).toEqual({
      type: 'unassign',
      memberIndex: 1,
    })
  })

  it('does nothing when there is no dragged member', () => {
    expect(resolveChipDrop(undefined, 'lang-es', 'es')).toEqual({ type: 'none' })
  })

  it('does nothing when dropped over nothing', () => {
    expect(resolveChipDrop(0, undefined, undefined)).toEqual({ type: 'none' })
    expect(resolveChipDrop(0, null, undefined)).toEqual({ type: 'none' })
  })

  it('does nothing when the drop target carries no code', () => {
    expect(resolveChipDrop(0, 'some-other-id', undefined)).toEqual({ type: 'none' })
  })
})

describe('resolveFlagTap', () => {
  it('places only the picked-up chip when tap-to-place is active, even with nothing open', () => {
    expect(resolveFlagTap('es', 2, 0)).toEqual({
      type: 'place',
      memberIndex: 2,
      code: 'es',
    })
  })

  it('places only the picked-up chip when tap-to-place is active and columns ARE open', () => {
    // Tap-to-place beats the whole-group shortcut even when it would not
    // otherwise apply — the picked-up chip always wins.
    expect(resolveFlagTap('es', 2, 3)).toEqual({
      type: 'place',
      memberIndex: 2,
      code: 'es',
    })
  })

  it('assigns the whole party on the first tap ever, with nothing open and no chip picked up', () => {
    expect(resolveFlagTap('de', null, 0)).toEqual({
      type: 'assignEveryone',
      code: 'de',
    })
  })

  it('just opens the column on a later tap, once at least one column is open', () => {
    expect(resolveFlagTap('en', null, 1)).toEqual({ type: 'open', code: 'en' })
    expect(resolveFlagTap('en', null, 3)).toEqual({ type: 'open', code: 'en' })
  })
})
