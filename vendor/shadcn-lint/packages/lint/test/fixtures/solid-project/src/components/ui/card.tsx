import type { ComponentProps } from "@solidjs/web"
import { omit } from "solid-js"

import { cn } from "~/lib/utils"

const Card = (props: ComponentProps<"div">) => {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card"
      class={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground",
        props.class
      )}
      {...rest}
    />
  )
}

const CardTitle = (props: ComponentProps<"div">) => {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-title"
      class={cn("leading-none font-semibold", props.class)}
      {...rest}
    />
  )
}

export { Card, CardTitle }
