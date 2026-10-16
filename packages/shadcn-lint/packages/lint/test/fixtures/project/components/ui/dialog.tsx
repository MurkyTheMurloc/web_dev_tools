import { Dialog as DialogPrimitive } from "@kobalte/core/dialog"
import type { ComponentProps } from "@solidjs/web"

function Dialog(props: ComponentProps<typeof DialogPrimitive>) {
  return <DialogPrimitive data-slot="dialog" {...props} />
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

export { Dialog, DialogTrigger }
