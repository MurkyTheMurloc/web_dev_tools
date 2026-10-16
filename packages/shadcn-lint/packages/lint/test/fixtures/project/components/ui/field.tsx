import { omit } from "solid-js"
import type { ComponentProps } from "@solidjs/web"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

// An axis not named "variant", and a second definition in the same
// file — both cases the v0 regex extractor missed.
const fieldVariants = cva("group/field flex w-full gap-3", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-center",
      responsive: "flex-col @md/field-group:flex-row",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

const fieldLabelVariants = cva("text-sm font-medium", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
    },
  },
})

function Field(props: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  const rest = omit(props, "class", "orientation")
  return (
    <div
      data-slot="field"
      class={cn(fieldVariants({ orientation: props.orientation }), props.class)}
      {...rest}
    />
  )
}

function FieldLabel(props: ComponentProps<"label"> & VariantProps<typeof fieldLabelVariants>) {
  const rest = omit(props, "class", "variant")
  return (
    <label
      data-slot="field-label"
      class={cn(fieldLabelVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  )
}

export { Field, FieldLabel, fieldVariants, fieldLabelVariants }
