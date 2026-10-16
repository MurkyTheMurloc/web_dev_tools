import { Scroller as ScrollerPrimitive, useScroller } from "minified-kit"
import { cn } from "@/lib/utils"

function ScrollerButton({ class: className }: { class?: string }) {
  return <ScrollerPrimitive.Button class={cn("bg-background", className)} />
}

export { ScrollerButton, useScroller }
