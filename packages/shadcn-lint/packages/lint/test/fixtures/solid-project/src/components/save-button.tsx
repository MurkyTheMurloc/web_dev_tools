// Solid 2.0 wrappers: each forwards the received `class` to a
// design-system component, read through `props` (never destructured),
// `omit` or `merge`.
import type { ComponentProps } from "@solidjs/web"
import { merge, omit } from "solid-js"

import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

type ButtonProps = ComponentProps<typeof Button>

// props.class through cn, the rest through omit.
export const SaveButton = (props: ButtonProps) => {
  const rest = omit(props, "class")
  return <Button class={cn("w-full", props.class)} {...rest} />
}

// props.class inside the array form of `class`.
export function ArrayButton(props: ButtonProps) {
  return <Button class={["w-full", props.class]}>Go</Button>
}

// The rest of an omit that leaves class in still carries it.
export const GhostButton = (props: ButtonProps) => {
  const rest = omit(props, "variant")
  return <Button variant="ghost" {...rest} />
}

// merge keeps the received class.
export const OutlineButton = (props: ButtonProps) => {
  const merged = merge({ variant: "outline" as const }, props)
  return <Button {...merged} />
}

// A merged default class, read back from the merged props.
export const WideButton = (props: ButtonProps) => {
  const merged = merge({ class: "w-full" }, props)
  return <Button class={cn("mt-2", merged.class)} />
}

// A wrapper of a wrapper.
export const PrimaryAction = (props: ButtonProps) => (
  <SaveButton class={cn("mt-2", props.class)} />
)

// Not a wrapper: class is omitted and never forwarded.
export const FixedButton = (props: ButtonProps) => {
  const rest = omit(props, "class")
  return <Button {...rest} class="w-full" />
}

// Not a wrapper: class lands on a plain element.
export const Section = (props: ComponentProps<"section">) => (
  <section class={cn("mx-auto max-w-4xl", props.class)} />
)

// Not a wrapper: merge overrides the received class with its own.
export const LockedButton = (props: ButtonProps) => {
  const merged = merge(props, { class: "w-full" })
  return <Button {...merged} />
}
