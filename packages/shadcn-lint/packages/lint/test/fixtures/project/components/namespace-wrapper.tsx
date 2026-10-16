import type { ComponentProps } from "@solidjs/web"
import * as UI from "@/components/ui/button"

// Forwards through a namespace import.
export function NamespaceButton(props: ComponentProps<typeof UI.Button>) {
  return <UI.Button {...props} />
}
