import type { Visitors } from "./types"

export type { ElementName, TemplateReader, Visitors } from "./types"

// One node type can carry two roles, so a second visitor joins the
// first.
export function addVisitor(
  visitors: Visitors,
  type: string,
  visit: (node: any) => void
) {
  const existing = visitors[type]
  visitors[type] = existing
    ? (node) => {
        existing(node)
        visit(node)
      }
    : visit
}

export function isContainer(node: any) {
  return node?.type === "JSXExpressionContainer"
}

// The attribute an expression container is the value of.
export function attributeOfContainer(container: any) {
  const attribute = container?.parent
  return attribute && isContainer(container) && attribute.type === "JSXAttribute"
    ? attribute
    : null
}

// A string written in the attribute, bare or inside a container.
export function staticStringOf(value: any) {
  const node = isContainer(value) ? value.expression : value
  return node?.type === "Literal" && typeof node.value === "string"
    ? (node.value as string)
    : null
}
