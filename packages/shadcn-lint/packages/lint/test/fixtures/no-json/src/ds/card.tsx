import { omit } from "solid-js"
import { cn } from "cn"
import type { ComponentProps } from "@solidjs/web"

function Card(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return <div class={cn("rounded-lg border border-line", props.class)} {...rest} />
}

function CardBody(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return <div class={cn("p-5", props.class)} {...rest} />
}

export { Card, CardBody }
