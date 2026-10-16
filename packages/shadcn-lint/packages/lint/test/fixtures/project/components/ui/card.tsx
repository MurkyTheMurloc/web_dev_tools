import { omit } from "solid-js"
import type { ComponentProps } from "@solidjs/web"
import { cn } from "@/lib/utils"

function Card(props: ComponentProps<"div"> & { size?: "default" | "sm" }) {
  const rest = omit(props, "class", "size")
  return (
    <div
      data-slot="card"
      data-size={props.size ?? "default"}
      class={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        props.class
      )}
      {...rest}
    />
  )
}

function CardHeader(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-header"
      class={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        props.class
      )}
      {...rest}
    />
  )
}

function CardTitle(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-title"
      class={cn(
        "cn-font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        props.class
      )}
      {...rest}
    />
  )
}

function CardDescription(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-description"
      class={cn("text-sm text-muted-foreground", props.class)}
      {...rest}
    />
  )
}

function CardAction(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-action"
      class={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        props.class
      )}
      {...rest}
    />
  )
}

function CardContent(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-content"
      class={cn("px-(--card-spacing)", props.class)}
      {...rest}
    />
  )
}

function CardFooter(props: ComponentProps<"div">) {
  const rest = omit(props, "class")
  return (
    <div
      data-slot="card-footer"
      class={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        props.class
      )}
      {...rest}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
