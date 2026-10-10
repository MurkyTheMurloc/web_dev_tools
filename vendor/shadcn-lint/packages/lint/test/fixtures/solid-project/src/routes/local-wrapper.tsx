import type { ComponentProps } from "@solidjs/web"

import { Button } from "~/components/ui/button"

const LocalButton = (props: ComponentProps<typeof Button>) => (
  <Button class={props.class}>Go</Button>
)

export const A = () => <LocalButton class="bg-primary" />
