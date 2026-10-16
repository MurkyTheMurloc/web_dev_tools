import { Button } from "@/components/ui/button"

// A default-exported wrapper, imported under whatever name the page picks.
export default function DefaultSaveButton({ class: className }: { class?: string }) {
  return <Button class={className}>Save</Button>
}
