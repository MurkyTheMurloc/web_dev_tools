// Solid 2.0 spells the received class `class`, never destructures props,
// and derives them with `merge` and `omit` (`mergeProps` and `splitProps`
// in 1.x).

const sources = /^(?:solid-js(?:\/.*)?|@solidjs\/.+)$/

export function isSolidSource(source: unknown) {
  return typeof source === "string" && sources.test(source)
}

export type SolidHelpers = {
  // Local names of Solid's `merge` and `omit`.
  merge: Set<string>
  omit: Set<string>
}

const byProgram = new WeakMap<object, SolidHelpers>()

export function solidHelpersOf(program: any): SolidHelpers {
  const cached = program ? byProgram.get(program) : undefined
  if (cached) return cached
  const helpers: SolidHelpers = {
    merge: new Set(),
    omit: new Set(),
  }
  for (const statement of program?.body ?? []) {
    if (statement.type !== "ImportDeclaration") continue
    if (!isSolidSource(statement.source?.value)) continue
    for (const spec of statement.specifiers ?? []) {
      if (spec.type !== "ImportSpecifier" || !spec.local?.name) continue
      const imported = spec.imported?.name ?? spec.imported?.value
      if (imported === "merge") helpers.merge.add(spec.local.name)
      if (imported === "omit") helpers.omit.add(spec.local.name)
    }
  }
  if (program) byProgram.set(program, helpers)
  return helpers
}

function calleeIn(node: any, names: Set<string>) {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    names.has(node.callee.name)
  )
}

function staticString(node: any): string | null {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value
  }
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked ?? null
  }
  return null
}

function keyOf(property: any): string | null {
  if (property?.type !== "Property") return null
  if (property.computed) return staticString(property.key)
  if (property.key?.type === "Identifier") return property.key.name
  if (property.key?.type === "Literal") return String(property.key.value)
  return null
}

const CLASS_KEYS = new Set(["class"])

// An argument after the props in `merge` that cannot set the class: an
// object literal whose keys are all readable and none of them the class.
function leavesClass(node: any) {
  return (
    node?.type === "ObjectExpression" &&
    node.properties.every((property: any) => {
      const key = keyOf(property)
      return key !== null && !CLASS_KEYS.has(key)
    })
  )
}

// The props argument of `merge(...sources)` when the received class
// survives the merge: later sources override earlier ones, so none after
// the props may set it. Null otherwise.
export function mergedPropsOf(
  call: any,
  helpers: SolidHelpers,
  isProps: (node: any) => boolean
) {
  if (!calleeIn(call, helpers.merge)) return null
  const args: any[] = call.arguments ?? []
  let index = -1
  for (let i = args.length - 1; i >= 0; i--) {
    if (isProps(args[i])) {
      index = i
      break
    }
  }
  if (index < 0 || !args.slice(index + 1).every(leavesClass)) return null
  return { props: args[index], defaults: args.slice(0, index) }
}

// The props argument of `omit(props, ...keys)` when the class is not one
// of the keys taken out. Null otherwise.
export function omittedPropsOf(
  call: any,
  helpers: SolidHelpers,
  isProps: (node: any) => boolean
) {
  if (!calleeIn(call, helpers.omit)) return null
  const [props, ...keys] = call.arguments ?? []
  if (!isProps(props)) return null
  const strings = keys.map(staticString)
  if (strings.some((key: string | null) => key === null || CLASS_KEYS.has(key)))
    return null
  return props
}
