import { describe, test } from "vitest"

import { plugin } from "../src/index"
import { noRestyle } from "../src/rules/no-restyle"
import { noUnknownClasses } from "../src/rules/no-unknown-classes"
import { requireStaticClasses } from "../src/rules/require-static-classes"
import { button, cn, createTester, PAGE } from "./helpers"

const tester = createTester()

const boundary = noRestyle as any

const appearance = () => ({ messageId: "appearanceClassWithVariants" })

// Layout may cross: these cases are about the shapes a value arrives in,
// and only the appearance class in each is meant to be reported.
const options = [{ allow: ["layout"] }]

describe("ordinary prop shapes reach the rules", () => {
  test("spreads, alternatives, class objects, member access", () => {
    tester.run("no-restyle", boundary, {
      valid: [
        {
          filename: PAGE,
          options,
          code: `${button}\nconst props = { class: "mt-4 w-full" }\nexport const A = () => <Button {...props} />`,
        },
        // Both branches read the same resolved variable.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst base = "mt-4"\nexport const A = ({ on }: { on: boolean }) => <Button class={on ? base : base}>Go</Button>`,
        },
      ],
      invalid: [
        // An object literal spread onto the element.
        {
          filename: PAGE,
          options,
          code: `${button}\nexport const A = () => <Button {...{ class: "bg-red-500 mt-4" }} />`,
          errors: [appearance()],
        },
        // A same-file object spread.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst props = { class: "rounded-full" }\nexport const A = () => <Button {...props} />`,
          errors: [appearance()],
        },
        // Both sides of || and ?? render.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst classes = "bg-red-500"\nexport const A = () => <Button class={classes || "w-full"}>Go</Button>`,
          errors: [appearance()],
        },
        {
          filename: PAGE,
          options,
          code: `${button}\nconst classes = "bg-red-500"\nexport const A = () => <Button class={classes ?? "w-full"}>Go</Button>`,
          errors: [appearance()],
        },
        // Identifier keys of a clsx object are classes.
        {
          filename: PAGE,
          options,
          code: `${button}\n${cn}\nexport const A = () => <Button class={cn({ rounded: true, italic: true, flex: true })}>Go</Button>`,
          errors: [appearance(), appearance()],
        },
        // theme.class through a same-file object.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst theme = { class: "bg-red-500" }\nexport const A = () => <Button class={theme.class}>Go</Button>`,
          errors: [appearance()],
        },
        // A classes object behind a variable is read by its values.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst classes = { root: "bg-red-500" }\nexport const A = () => <Button classes={classes}>Go</Button>`,
          errors: [appearance()],
        },
      ],
    })
  })

  test("template interpolation does not leave half a class behind", () => {
    tester.run("require-static-classes", requireStaticClasses as any, {
      valid: [],
      invalid: [
        {
          filename: PAGE,
          code: `${button}\nexport const A = ({ n }: { n: number }) => <Button class={\`mt-\${n} w-full\`}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
      ],
    })
    // The partial "mt-" is not judged as a class by the other rules.
    tester.run(
      "no-unknown-classes",
      plugin.rules["no-unknown-classes"] as any,
      {
        valid: [
          {
            filename: PAGE,
            code: `export const A = ({ n }: { n: number }) => <div class={\`mt-\${n} w-full\`} />`,
          },
        ],
        invalid: [],
      }
    )
  })

  test("a forwarded class prop is recognized by its binding", () => {
    tester.run("require-static-classes", requireStaticClasses as any, {
      valid: [
        {
          filename: PAGE,
          code: `${button}\nexport function Save({ class: cls }: { class?: string }) { return <Button class={cls}>Save</Button> }`,
        },
        {
          filename: PAGE,
          code: `${button}\nexport function Save(props: { class?: string }) { return <Button class={props.class}>Save</Button> }`,
        },
      ],
      invalid: [
        // Another prop is not the forwarded class prop.
        {
          filename: PAGE,
          code: `${button}\nexport function Save({ tone }: { tone: string }) { return <Button class={tone}>Save</Button> }`,
          errors: [{ messageId: "dynamicClasses" }],
        },
      ],
    })
  })
})

describe("variant helper configs", () => {
  test("tv settings keys are not class strings", () => {
    tester.run("no-unknown-classes", noUnknownClasses as any, {
      valid: [
        {
          filename: PAGE,
          code: `import { tv } from "tailwind-variants"\nexport const box = tv({ base: "flex", variants: { size: { sm: "p-2" } }, responsiveVariants: ["sm", "md"], defaultVariants: { size: "sm" } })`,
        },
      ],
      invalid: [],
    })
  })

  test("a variant keyed by a computed name is still checked", () => {
    const cva = `import { cva } from "class-variance-authority"\nenum Size { Small = "small" }`
    tester.run("no-arbitrary-values", plugin.rules["no-arbitrary-values"], {
      valid: [],
      invalid: [
        {
          filename: PAGE,
          code: `${cva}\nexport const v = cva("flex", { variants: { size: { [Size.Small]: "p-[13px]" } } })`,
          errors: 1,
        },
      ],
    })
    tester.run("no-unknown-classes", noUnknownClasses as any, {
      valid: [],
      invalid: [
        {
          filename: PAGE,
          code: `${cva}\nexport const v = cva("flex", { variants: { size: { [Size.Small]: "zzqq-nope" } } })`,
          errors: 1,
        },
      ],
    })
  })
})
