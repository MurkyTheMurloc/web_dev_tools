// A Solid 2.0 shadcn button: props are never destructured, `omit` instead
// of splitProps.
import type { ComponentProps } from "@solidjs/web"
import { cva, type VariantProps } from "class-variance-authority"
import { omit } from "solid-js"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border bg-background",
        ghost: "hover:bg-muted",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>

const Button = (props: ButtonProps) => {
  const rest = omit(props, "class", "variant", "size")
  return (
    <button
      data-slot="button"
      class={cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.class
      )}
      {...rest}
    />
  )
}

export { Button, buttonVariants }
