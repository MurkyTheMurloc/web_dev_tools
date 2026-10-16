import { omit } from "solid-js"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "@solidjs/web"

import { cn } from "@workspace/ui/lib/utils"

const buttonVariants = cva("inline-flex rounded-md", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      brand: "bg-brand text-primary-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

function Button(props: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  const rest = omit(props, "class", "variant")
  return (
    <button class={cn(buttonVariants({ variant: props.variant }), props.class)} {...rest} />
  )
}

export { Button, buttonVariants }
