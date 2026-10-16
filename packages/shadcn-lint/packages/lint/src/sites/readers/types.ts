// What the JSX reader answers for the collector. Everything past these
// questions is the value walker, component identity, contracts and
// messages.

export type ElementName = {
  // The `Dialog` of `<Dialog.Content>`. Empty when it cannot be read.
  root: string
  property: string | null
  // The tag as written.
  text: string
  // False for an intrinsic element.
  component: boolean
}

export type Visitors = Record<string, (node: any) => void>

export type TemplateReader = {
  attributes: string[]
  spreads: string[]
  attributeName: (node: any) => string
  // Null when the attribute has no value.
  attributeValue: (node: any) => any
  spreadArgument: (node: any) => any
  // The element an attribute or a spread sits on.
  elementOf: (node: any) => any
  nameOf: (element: any) => ElementName | null
  // The nearest enclosing element, past fragments and blocks.
  parentElementOf: (element: any) => any
}
