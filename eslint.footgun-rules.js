// landr-x44uz.3 — footguns enforced as lint (bd: js-window-shadow-foot-gun,
// fetch-spy-response-mockResolvedValue-footgun).
const SHADOWED = 'window|document|location|history|performance|fetch|console|navigator'
const NAMES = `/^(${SHADOWED})$/`
const SHADOW_MSG =
  'Do not declare a local binding named after a browser global (window, document, location, history, performance, fetch, console, navigator): it shadows the global and breaks later references silently (js-window-shadow-foot-gun). Rename it.'

const shadowSel = (selector) => ({ selector: `${selector}[name=${NAMES}]`, message: SHADOW_MSG })

/** Local bindings (variables, params, destructuring, catch, declarations) named like a browser global. */
export const globalShadowRestrictedSyntax = [
  shadowSel('VariableDeclarator > Identifier.id'),
  shadowSel(':function > Identifier.params'),
  shadowSel('FunctionDeclaration > Identifier.id'),
  shadowSel('ClassDeclaration > Identifier.id'),
  shadowSel('ObjectPattern > Property > Identifier.value'),
  shadowSel('ObjectPattern > Property > AssignmentPattern > Identifier.left'),
  shadowSel('ArrayPattern > Identifier'),
  shadowSel('AssignmentPattern > Identifier.left'),
  shadowSel('RestElement > Identifier.argument'),
  shadowSel('CatchClause > Identifier.param'),
]

/** Test files only: one shared Response is consumed by the first reader. */
export const sharedResponseMockRestrictedSyntax = [
  {
    selector:
      "CallExpression[callee.property.name='mockResolvedValue'][arguments.0.type='NewExpression'][arguments.0.callee.name='Response']",
    message:
      'mockResolvedValue(new Response(...)) hands every call the SAME Response, and a body can be read once, so a second parallel call fails. Use mockImplementation(async () => new Response(...)) (fetch-spy-response-mockResolvedValue-footgun).',
  },
]

export const testFileGlobs = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
