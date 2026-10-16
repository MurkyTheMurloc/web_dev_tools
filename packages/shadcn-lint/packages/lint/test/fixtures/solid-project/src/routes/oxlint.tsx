// Linted by test/oxlint.test.ts through Oxlint's jsPlugins: a Solid 2.0
// page reads the same under Oxlint as under ESLint.
import { createSignal } from "solid-js"

import { SaveButton } from "~/components/save-button"
import { Button } from "~/components/ui/button"

export const OxlintCheck = () => {
  const [active] = createSignal(false)
  return (
    <>
      <Button class={{ "bg-red-500": active(), "mt-2": true }}>Go</Button>
      <SaveButton class={["mt-2", { "rounded-full": active() }]}>Save</SaveButton>
      <div class={{ "text-[13px]": active() }} />
    </>
  )
}
