import { omit } from "solid-js"
import type { ComponentProps } from "@solidjs/web"
// A wrapper of an open container: forwards class to CardContent,
// so from outside it accepts spacing the way CardContent does.
import { cn } from "@/lib/utils"

import { CardContent } from "@/components/ui/card"

export function Panel(props: ComponentProps<typeof CardContent>) {
  const rest = omit(props, "class")
  return <CardContent class={cn("py-6", props.class)} {...rest} />
}
