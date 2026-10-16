import { omit } from "solid-js"
import type { ComponentProps } from "@solidjs/web"
// A wrapper: forwards class to a design-system component, so from
// outside it is that component.
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

export function SaveButton(props: ComponentProps<typeof Button>) {
  const rest = omit(props, "class")
  return <Button class={cn("w-full", props.class)} {...rest} />
}

// Not a wrapper: class lands on a plain element.
export function Section(props: ComponentProps<"section">) {
  const rest = omit(props, "class")
  return <section class={cn("mx-auto max-w-4xl", props.class)} {...rest} />
}

// A wrapper through props.class.
export const CancelButton = (props: ComponentProps<typeof Button>) => (
  <Button variant="ghost" class={props.class} />
)

// A wrapper of a wrapper.
export function PrimaryAction({ class: className }: { class?: string }) {
  return <SaveButton class={cn("mt-2", className)} />
}

// Not a wrapper: class is destructured out and never forwarded.
export function FixedButton(props: ComponentProps<typeof Button>) {
  const rest = omit(props, "class")
  return <Button {...rest} class="w-full" />
}
