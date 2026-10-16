import { Button } from "@/components/ui/button"

function LocalButton({ class: className }: { class?: string }) {
  return <Button class={className}>Go</Button>
}

export const A = () => <LocalButton class="bg-red-500" />
