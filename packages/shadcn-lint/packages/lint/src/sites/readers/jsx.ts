import type { TemplateReader } from "./types"

// Astro's `class:list` parses as a namespaced name.
export function attributeNameOf(attribute: any) {
  const name = attribute?.name
  if (name?.type === "JSXNamespacedName") {
    return `${name.namespace?.name}:${name.name?.name}`
  }
  return typeof name?.name === "string" ? name.name : ""
}

function jsxNameText(jsxName: any): string {
  if (jsxName?.type === "JSXMemberExpression") {
    return `${jsxNameText(jsxName.object)}.${jsxName.property?.name ?? ""}`
  }
  return jsxName?.name ?? ""
}

// The `Dialog` of `<Dialog.Content>`.
export function jsxRootOf(jsxName: any) {
  return jsxName?.type === "JSXMemberExpression"
    ? jsxName.object?.name
    : jsxName?.name
}

export function jsxElementNameOf(name: any) {
  if (!name) return null
  const root = jsxRootOf(name)
  const member = name.type === "JSXMemberExpression"
  return {
    root: typeof root === "string" ? root : "",
    property: member ? (name.property?.name ?? "") : null,
    text: jsxNameText(name),
    component:
      member || (name.type === "JSXIdentifier" && /^[A-Z]/.test(name.name)),
  }
}

export const jsxReader: TemplateReader = {
  attributes: ["JSXAttribute"],
  spreads: ["JSXSpreadAttribute"],
  attributeName: attributeNameOf,
  attributeValue: (node) => node.value,
  spreadArgument: (node) => node.argument,
  elementOf(node) {
    const opening = node?.parent
    return opening?.type === "JSXOpeningElement" ? opening.parent : null
  },
  nameOf: (element) => jsxElementNameOf(element?.openingElement?.name),
  // Fragments and expression containers are not layout parents.
  parentElementOf(element) {
    for (let node = element?.parent; node; node = node.parent) {
      if (node.type === "JSXElement") return node
    }
    return null
  },
}
