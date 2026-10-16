import { describe, test } from "vitest"

import { requireStaticClasses } from "../src/rules/require-static-classes"
import { button, cn, createTester, PAGE } from "./helpers"

const tester = createTester()
const rule = requireStaticClasses as any

describe("require-static-classes", () => {
  test("rule", () => {
    tester.run("require-static-classes", rule, {
      valid: [
        {
          filename: PAGE,
          code: `${button}\nexport const A = () => <Button class="mt-4">Go</Button>`,
        },
        {
          filename: PAGE,
          code: `${button}\n${cn}\nexport const A = ({ on, class: className }: { on: boolean; class?: string }) => <Button class={cn("mt-4", on && "w-full", className)}>Go</Button>`,
        },
        {
          filename: PAGE,
          code: `${button}\n${cn}\nexport const A = ({ on }: { on: boolean }) => <Button class={cn({ "w-full": on })}>Go</Button>`,
        },
        // One hop resolves a same-file constant, so it is static.
        {
          filename: PAGE,
          code: `${button}\nconst layout = "mt-4"\nexport const A = () => <Button class={layout}>Go</Button>`,
        },
        // Plain elements are out of scope.
        {
          filename: PAGE,
          code: `export const A = ({ cls }: { cls: string }) => <div class={cls} />`,
        },
      ],
      invalid: [
        {
          filename: PAGE,
          code: `${button}\nexport const A = ({ cls }: { cls: string }) => <Button class={cls}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        {
          filename: PAGE,
          code: `${button}\nexport const A = ({ size }: { size: string }) => <Button class={\`p-\${size}\`}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        {
          filename: PAGE,
          code: `${button}\n${cn}\nexport const A = ({ extra }: { extra: string }) => <Button class={cn("mt-4", extra)}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        {
          filename: PAGE,
          code: `${button}\nexport const A = () => <Button class={makeClasses()}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        // A reassigned variable is not resolvable.
        {
          filename: PAGE,
          code: `${button}\nlet c = "mt-4"\nc = "bg-red-500"\nexport const A = () => <Button class={c}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
      ],
    })
  })
})
