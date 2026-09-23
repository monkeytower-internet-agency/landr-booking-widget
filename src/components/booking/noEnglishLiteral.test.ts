/**
 * landr-5aih0.9: guard against English chrome text creeping back into the
 * widget's component tree outside src/lib/strings.ts's bundle (or a
 * page-scoped sibling bundle, e.g. approvalReplyStrings.ts).
 *
 * Scans every .tsx/.ts file under src/components/booking/** for JSX text
 * nodes and common string-literal attributes (aria-label=, placeholder=,
 * title=) that look like real English prose (a capitalised word run, not a
 * code token). Comments are stripped first so JSDoc examples don't produce
 * false positives. Mirrors landr-ifcu's precedent of excluding
 * src/api/mocks.ts (fixture data, not chrome).
 *
 * This is NOT a claim that every string in the tree is translated —
 * several areas are deliberately deferred (see landr-5aih0.9's PR
 * description / handoff for the full list and why): drag-and-drop
 * screen-reader announcer sentences (ParticipantLanguageBoard.tsx,
 * RoomAssignment.tsx), staff-only force-book confirm() dialogs and the
 * staff price-override UI, MultiDayPicker's invite-mode diff chrome and
 * mode-toggle labels, AccommodationStep's shared-double reference-lookup
 * sub-flow and rare occupancy-hint sentences, Confirmation's
 * invite/group/join-reference cards, and BookingForm's deep 422
 * error-mapping sentences beyond the single-language-assignment message.
 * Each is listed in ALLOWED_LITERALS below, one file at a time, so a
 * genuinely NEW English string anywhere else in the tree still fails this
 * test — the allowlist only covers what was already known and deferred
 * when this guard was written.
 *
 * Operator-authored content (product/category names, custom-form field
 * labels, after-booking HTML) is never hard-coded text in the component
 * tree — it always arrives over the wire — so it never needs an allowlist
 * entry here.
 */
import { describe, expect, it } from 'vitest'

// Vite-native file read (no Node `fs`/`path` typings needed in this
// browser-targeted tsconfig — see tsconfig.app.json's `types` array).
// Eager + '?raw' resolves every matching file's source as a string at
// import time, keyed by its path relative to this file.
const RAW_FILES = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Per-file allowlist of exact literal strings this guard would otherwise
 * flag. Keyed by path relative to src/components/booking/. Add an entry
 * here ONLY for a string that is genuinely out of this ticket's scope
 * (see the file header) — never to silence a string that should actually
 * be translated.
 */
const ALLOWED_LITERALS: Record<string, string[]> = {
  // Shared-double join-by-reference lookup mini-flow (AccommodationStep) —
  // deferred as a self-contained unit so it isn't left half-translated:
  // the reference-code input, its lookup states, and the found-a-match
  // confirm/decline step.
  'AccommodationStep.tsx': [
    'Looking that up…',
    'Booking reference of the person who booked the room',
    'Yes, link us',
    'No',
  ],
  // Staff-only price-override UI (canOverridePrice / staff.active gated) —
  // never reached by a normal customer.
  'BookingForm.tsx': [
    'New gross total',
    'Reason',
    'Leave blank to use the calculated total. When set, this gross total replaces the computed price for this booking.',
  ],
  // Mode-toggle chrome (Date range / Individual days) + its aria-label,
  // and the invite-mode diff legend/summary/reset chrome — all deferred,
  // see the file header.
  'MultiDayPicker.tsx': [
    '[aria-label] Selection mode',
    'Date range',
    'Individual days',
    'Added',
    'Removed',
  ],
  // Staff-only "operator override" indicator (force-book past capacity /
  // lead time) — never shown to a normal customer.
  'OperatorOverrideBadge.tsx': ['Operator override'],
  // Regex artifact, not real text: `disabled={(date) => date < today || …}`
  // — the `<` in the comparison reads as a JSX tag boundary to this guard's
  // naive `>text<` scanner, so the `date` identifier gets matched as if it
  // were JSX text. No such literal actually renders.
  'SingleDatePicker.tsx': ['date'],
  // Neutral "misconfigured embed" placeholder shown only when the widget
  // token is missing/invalid — a config/diagnostic page an operator's
  // developer sees while wiring up the embed, not part of the booking flow
  // a customer ever reaches with a valid link.
  'LandingPage.tsx': ['This is the booking-widget host for Landr', 'www.landr.de'],
  // InviteCard / GroupBlock / SharedDoubleHint — the post-booking
  // group-invite sub-flow, deferred as a self-contained unit (see the file
  // header). "Google Calendar" / "Outlook" are the calendar-provider CTAs
  // right above it — provider brand names, never translated. "Google Maps"
  // / "Waze" (landr-5aih0.2) are the same pattern one section up — the
  // meeting-point deep-link buttons; their aria-labels ARE translated
  // (meetingPointOpenInGoogleMapsAria/meetingPointOpenInWazeAria).
  'Confirmation.tsx': [
    'WhatsApp',
    'Email sending unavailable — copy the link instead.',
    'Booked together with',
    'Add their reference on your booking page',
    'Each of them completes their own booking from their link.',
    'Google Calendar',
    'Outlook',
    'Google Maps',
    'Waze',
  ],
}

// approvalReplyStrings.ts already ships its own de/en/es bundle under a
// separate locale-resolution rule (see its file header) — English rows
// there are one of three intentional locales, not stray chrome.
const IGNORED_FILES = new Set(['approvalReplyStrings.ts'])

// landr-ifcu precedent: fixture/mock data (and decorative SVG icon source)
// is not chrome.
const IGNORED_DIRS = new Set(['/art/'])

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// Matches JSX text between tags (allows internal newlines — prettier often
// wraps long text onto its own line) and a handful of chrome-bearing
// string-literal attributes. Both are conservative: a match must contain a
// run of 2+ letters, and lines that still look like code (braces, `=`,
// `//`, common JS keywords) are rejected.
const JSX_TEXT_RE = />\s*([^<>{}][^<>{}]*[A-Za-z]{2,}[^<>{}]*)\s*</g
const ATTR_RE = /\b(aria-label|placeholder|title|alt)=["']([^"']*[A-Za-z]{2,}[^"']*)["']/g

const CODE_TOKENS = [
  'void',
  'null',
  'const',
  'return',
  'useState',
  'useMemo',
  'useCallback',
  'landr-',
  '=>',
  '===',
  '!==',
  '&&',
  '||',
  'typeof',
  'ReturnType',
  'import ',
  'export ',
  // TypeScript type-position artifacts (multi-line interface/type props,
  // generics) that this naive `>text<` scanner otherwise misreads as JSX
  // text when a `<...>` generic spans multiple lines.
  '?:',
  'Record',
  'Pick',
  'RoomAssignmentMap',
  'OccupantAgeMap',
  'PerRoomAddons',
]

function looksLikeCode(text: string): boolean {
  if (/[{}();]/.test(text)) return true
  return CODE_TOKENS.some((t) => text.includes(t))
}

/** './Foo/Bar.tsx' → 'Foo/Bar.tsx' (path relative to this file, glob-style). */
function relPath(globKey: string): string {
  return globKey.replace(/^\.\//, '')
}

function collectFiles(): string[] {
  return Object.keys(RAW_FILES)
    .filter((key) => !key.endsWith('.test.ts') && !key.endsWith('.test.tsx'))
    .filter((key) => !IGNORED_FILES.has(relPath(key).split('/').pop()!))
    .filter((key) => ![...IGNORED_DIRS].some((d) => key.includes(d)))
}

function findLiterals(source: string): string[] {
  const stripped = stripComments(source)
  const hits: string[] = []
  for (const m of stripped.matchAll(JSX_TEXT_RE)) {
    const text = m[1]!.trim().replace(/\s+/g, ' ')
    if (text && !looksLikeCode(text) && text.length > 1) hits.push(text)
  }
  for (const m of stripped.matchAll(ATTR_RE)) {
    const value = m[2]!.trim()
    if (value && !looksLikeCode(value)) hits.push(`[${m[1]}] ${value}`)
  }
  return hits
}

describe('no stray English literals in the booking component tree (landr-5aih0.9)', () => {
  const files = collectFiles()

  it('found booking component files to scan', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  for (const globKey of files) {
    const rel = relPath(globKey)
    const fileName = rel.split('/').pop()!
    it(`${rel} has no un-allowlisted English chrome literals`, () => {
      const source = RAW_FILES[globKey]!
      const hits = findLiterals(source)
      const allowed = new Set(ALLOWED_LITERALS[fileName] ?? [])
      const unexpected = hits.filter((h) => !allowed.has(h))
      expect(
        unexpected,
        `${rel} has literal text that looks like un-translated widget chrome:\n` +
          unexpected.map((h) => `  - ${h}`).join('\n') +
          '\n\nMove it into src/lib/strings.ts (pickBundle/tr) and render it via ' +
          'tr(\'key\', locale), or add it to ALLOWED_LITERALS in this test with a ' +
          'comment explaining why it is deliberately out of scope.',
      ).toEqual([])
    })
  }
})
