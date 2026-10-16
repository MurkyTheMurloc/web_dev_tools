import { omit } from "solid-js"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { ComponentProps } from "@solidjs/web"

export const buttonVariants = cva("inline-flex rounded-md", {
  variants: {
    variant: {
      primary: "bg-accent text-accent-ink",
      secondary: "border border-line bg-paper text-ink",
    },
    size: { sm: "h-8", md: "h-10" },
  },
  defaultVariants: { variant: "primary", size: "md" },
})

export function Button(props: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  const rest = omit(props, "class", "variant", "size")
  return (
    <button
      class={cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)}
      {...rest}
    />
  )
}
