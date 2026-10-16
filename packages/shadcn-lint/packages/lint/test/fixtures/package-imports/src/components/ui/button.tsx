import { omit } from "solid-js"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "@solidjs/web"

import { cn } from "#lib/utils"

const buttonVariants = cva("inline-flex rounded-md", {
  variants: {
    variant: {
      default: "bg-primary text-white",
      outline: "border bg-white",
    },
    size: { default: "h-9", sm: "h-8" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

function Button(props: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  const rest = omit(props, "class", "variant", "size")
  return (
    <button
      class={cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)}
      {...rest}
    />
  )
}

export { Button, buttonVariants }
