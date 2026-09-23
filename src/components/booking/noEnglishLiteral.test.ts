/**
 * landr-5aih0.9 / landr-5aih0.17: guard against English chrome text creeping
 * back into the widget's component tree outside src/lib/strings.ts's bundle
 * (or a page-scoped sibling bundle, e.g. approvalReplyStrings.ts).
 *
 * landr-5aih0.17 rewrote the extraction from a `>text<` / attribute REGEX to
 * a real TypeScript-AST walk (`ts.createSourceFile`, already a project
 * devDependency — no new dependency). The regex version had three
 * independent blind spots that let real untranslated strings ship silently:
 *
 *  1. JSX text split by an embedded `{expr}` (e.g. `Everyone speaks
 *     {languageName(code)}`) never matched `>text<` because the text wasn't
 *     immediately followed by `<`.
 *  2. A `>` used as a plain comparison operator in ordinary TS code (e.g.
 *     `date > today`) could start a bogus regex match that swallowed real
 *     JSX text up to the next `<`/`>`/`{`/`}`, merging it with surrounding
 *     code into one blob `looksLikeCode` then correctly-but-uselessly
 *     rejected — hiding the genuine text inside it instead of flagging it.
 *  3. `looksLikeCode`'s `/[{}();]/` check treated ANY parenthetical aside
 *     ("Email (optional)", "Reason for the override (required when set)")
 *     as code, and the attribute scan only covered aria-label/placeholder/
 *     title/alt — missing `label=` and other text-bearing component props
 *     (`heading=` on AddonsList, for one).
 *
 * The AST walk sidesteps all three: JsxText nodes are already correctly
 * segmented around `{expr}` children by the parser, a real parser never
 * misreads a comparison operator as a JSX tag, and there is no
 * parenthesis/semicolon heuristic to fool. It additionally follows simple
 * ternary/`&&`/`||`/`??` chains in JSX child position (e.g. `{cond ? 'Some
 * text' : tr('key', locale)}`) to catch a literal hidden behind a condition
 * — the old regex could never see inside a `{}` at all.
 *
 * Deliberately NOT covered (bounded scope, see landr-5aih0.17's ticket):
 * template-literal JSX attributes (`aria-label={\`Remove ${x}\`}`) and
 * strings that only reach the tree via a variable/prop rather than a
 * literal at the child/attribute site. Both exist elsewhere in this tree;
 * flagging them is a materially larger, separately-scoped follow-up (see
 * the ticket's handoff).
 *
 * This is NOT a claim that every string in the tree is translated —
 * several areas are deliberately deferred, each listed in ALLOWED_LITERALS
 * below with a comment explaining why: drag-and-drop screen-reader
 * announcer sentences (languageBoardDrop.ts's template literals never reach
 * this scanner at all — they're plain .ts, no JSX — RoomAssignment.tsx's
 * own `announcements` object is the same shape), staff-only UI (force-book
 * banners, the price-override panel, the operator-override badge — gated on
 * `staff.active`/`canOverridePrice`/force-book capability, never reached by
 * a normal customer), brand names (WhatsApp, Google Calendar, Outlook,
 * Google Maps, Waze, the landr.de domain), and BookingForm's deep 422
 * language-assignment error-mapping sentences beyond the single-assignment
 * message (out of both landr-5aih0.9's and landr-5aih0.17's scope).
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

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
 * here ONLY for a string that is genuinely out of scope (see the file
 * header) — never to silence a string that should actually be translated.
 * A JsxText/JSX-child-literal hit is the trimmed, whitespace-collapsed
 * text; an attribute hit is `[attrName] value`.
 */
const ALLOWED_LITERALS: Record<string, string[]> = {
  // Staff-only price-override UI (canOverridePrice / staff.active gated) —
  // never reached by a normal customer.
  'BookingForm.tsx': [
    'New gross total',
    'Reason',
    'Leave blank to use the calculated total. When set, this gross total replaces the computed price for this booking.',
    'Override price (operator)',
    '[placeholder] Reason for the override (required when set)',
  ],
  // landr-aoak.2 [S3]: staff force-book summary — only rendered when the
  // staff selection includes a force-booked day (past a gate a normal
  // customer's picker never lets them cross); forceBookReasonMessage()
  // itself stays English by decision (see its doc in src/lib/strings.ts).
  // Nothing here is a literal any more (the banner's text is entirely
  // function-generated), kept as documentation of why this section is
  // exempt rather than an active entry.
  'MultiDayPicker.tsx': [
    // landr-aoak.2: the operator-override "N forced day(s) (reasons)"
    // badge line is staff-only (forcedDays is only non-empty when staff
    // force-booked past a gate) — same precedent as forceBookReasonMessage.
    'forced',
    'day',
    'days',
  ],
  // Staff-only "operator override" indicator (force-book past capacity /
  // lead time) — never shown to a normal customer.
  'OperatorOverrideBadge.tsx': ['Operator override'],
  // landr-5aih0.17: operator-framed copy shown ONLY when staff.active — a
  // normal customer never reaches this branch (see the surrounding
  // `staff.active ? (...) : ...` in Confirmation.tsx).
  'Confirmation.tsx': [
    'Booking created on behalf of the customer. It is currently',
    // Provider/brand names, never translated.
    'WhatsApp',
    'Google Calendar',
    'Outlook',
    'Google Maps',
    'Waze',
  ],
  // Domain name — a URL, not prose; the page's own title IS translated
  // (landingPageTitle in src/lib/strings.ts).
  'LandingPage.tsx': ['www.landr.de'],
}

// approvalReplyStrings.ts already ships its own de/en/es bundle under a
// separate locale-resolution rule (see its file header) — English rows
// there are one of three intentional locales, not stray chrome. It has no
// JSX, so this scanner would find nothing in it either way; kept as
// documentation of that precedent.
const IGNORED_FILES = new Set(['approvalReplyStrings.ts'])

// landr-ifcu precedent: fixture/mock data (and decorative SVG icon source)
// is not chrome.
const IGNORED_DIRS = ['/art/']

/** Text-bearing JSX attributes this guard scans for a plain string-literal value. */
const TEXT_ATTRS = new Set(['aria-label', 'placeholder', 'title', 'alt', 'label', 'heading'])

/** A run of 2+ Latin letters once named HTML entities (&rsquo; &minus; &times; …) are stripped, so a lone symbol entity doesn't misread as a word. */
function looksTranslatable(text: string): boolean {
  const stripped = text.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, '')
  return /[A-Za-z]{2,}/.test(stripped)
}

/** './Foo/Bar.tsx' → 'Foo/Bar.tsx' (path relative to this file, glob-style). */
function relPath(globKey: string): string {
  return globKey.replace(/^\.\//, '')
}

function collectFiles(): string[] {
  return Object.keys(RAW_FILES)
    .filter((key) => !key.endsWith('.test.ts') && !key.endsWith('.test.tsx'))
    .filter((key) => !IGNORED_FILES.has(relPath(key).split('/').pop()!))
    .filter((key) => !IGNORED_DIRS.some((d) => key.includes(d)))
}

/**
 * Follows a JSX child expression through ternary/logical-short-circuit
 * chains looking for a bare string literal — the `{cond ? 'Some text' :
 * tr('key', locale)}` shape. Deliberately does NOT recurse into call
 * expressions, template literals with substitutions, arrow functions,
 * object/array literals, etc. — those aren't a literal rendering directly,
 * and going further starts pulling in values that only reach the tree via
 * a variable (out of this guard's bounded scope, see the file header).
 */
function collectChildLiterals(node: ts.Node, hits: string[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text && looksTranslatable(node.text)) hits.push(node.text)
  } else if (ts.isConditionalExpression(node)) {
    collectChildLiterals(node.whenTrue, hits)
    collectChildLiterals(node.whenFalse, hits)
  } else if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      collectChildLiterals(node.left, hits)
      collectChildLiterals(node.right, hits)
    }
  } else if (ts.isParenthesizedExpression(node)) {
    collectChildLiterals(node.expression, hits)
  }
}

function findLiterals(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hits: string[] = []

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim().replace(/\s+/g, ' ')
      if (text && looksTranslatable(text)) hits.push(text)
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile)
      if (TEXT_ATTRS.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          const value = node.initializer.text.trim()
          if (value && looksTranslatable(value)) hits.push(`[${name}] ${value}`)
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          collectChildLiterals(node.initializer.expression, hits)
        }
      }
    } else if (ts.isJsxExpression(node) && node.expression) {
      const parent = node.parent
      if (parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
        collectChildLiterals(node.expression, hits)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return hits
}

describe('no stray English literals in the booking component tree (landr-5aih0.9 / landr-5aih0.17)', () => {
  const files = collectFiles()

  it('found booking component files to scan', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  for (const globKey of files) {
    const rel = relPath(globKey)
    const fileName = rel.split('/').pop()!
    it(`${rel} has no un-allowlisted English chrome literals`, () => {
      const source = RAW_FILES[globKey]!
      const hits = findLiterals(source, rel)
      const allowed = new Set(ALLOWED_LITERALS[fileName] ?? [])
      const unexpected = hits.filter((h) => !allowed.has(h))
      expect(
        unexpected,
        `${rel} has literal text that looks like un-translated widget chrome:\n` +
          unexpected.map((h) => `  - ${h}`).join('\n') +
          '\n\nMove it into src/lib/strings.ts (pickBundle/tr) and render it via ' +
          "tr('key', locale), or add it to ALLOWED_LITERALS in this test with a " +
          'comment explaining why it is deliberately out of scope.',
      ).toEqual([])
    })
  }
})
