import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { Linter } from "eslint"
import { beforeEach, describe, expect, it } from "vitest"

import { plugin } from "../src/plugin"
import { parseSource } from "../src/project/parser"
import { clearWrapperCache, wrapperTargetOf } from "../src/project/wrappers"

const POLICY = { allow: ["layout"] }

const RULES = {
  "shadcn/no-restyle": ["error", POLICY],
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": ["error", POLICY],
  "shadcn/no-inline-styles": "error",
  "shadcn/require-static-classes": "error",
} as const

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures"
)
const SOLID_PROJECT = path.join(FIXTURES, "solid-project")
const SOLID_PAGE = path.join(SOLID_PROJECT, "src/routes/index.tsx")
const SOLID_WRAPPERS = path.join(
  SOLID_PROJECT,
  "src/components/save-button.tsx"
)
const SOLID_BUTTON = path.join(SOLID_PROJECT, "src/components/ui/button.tsx")

// Runs the plugin the way a Solid 2.0 project does: ESLint with the
// TypeScript parser over .tsx files.
function lintTsx(code: string, filename: string) {
  const linter = new Linter({ cwd: path.dirname(filename) })
  return linter.verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { shadcn: plugin as any },
        rules: RULES as any,
      },
    ],
    { filename }
  )
}

const header = `import { createSignal } from "solid-js"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { cn } from "~/lib/utils"
const [active] = createSignal(false)
const [tone] = createSignal("p-2")
`

// The same files are read with different sources from case to case.
beforeEach(clearWrapperCache)

const found = (markup: string, prefix = header, file = SOLID_PAGE) =>
  lintTsx(`${prefix}export const Page = () => (${markup})\n`, file).map(
    (m) => `${m.ruleId}: ${m.message.split(".")[0]}`
  )

describe("Solid 2.0 class sites", () => {
  it("reads a string class", () => {
    expect(found(`<div class="bg-red-500 p-[13px]" />`)).toEqual([
      `shadcn/no-raw-colors: "bg-red-500" uses the raw Tailwind palette`,
      `shadcn/no-arbitrary-values: "p-[13px]" hardcodes an off-token value`,
    ])
  })

  it("reads the keys of a class object and ignores its values", () => {
    expect(
      found(`<div class={{ "bg-red-500": active(), flex: "text-red-500" }} />`)
    ).toEqual([
      `shadcn/no-raw-colors: "bg-red-500" uses the raw Tailwind palette`,
    ])
    // The condition is not a class, so nothing is left unreadable.
    expect(
      found(`<Button class={{ "mt-2": active(), "w-full": true }} />`)
    ).toEqual([])
    expect(found(`<Button class={{ "bg-primary": active() }} />`)).toEqual([
      `shadcn/no-restyle: "bg-primary" is not allowed on <Button>: <Button> owns its color`,
    ])
  })

  it("reads a class object through a same-file const", () => {
    expect(
      found(
        `<div class={styles} />`,
        `${header}const styles = { "text-red-500": true }\n`
      )
    ).toEqual([
      `shadcn/no-raw-colors: "text-red-500" uses the raw Tailwind palette`,
    ])
  })

  it("reports an unreadable class object key on a component", () => {
    expect(found(`<Button class={{ [tone()]: active() }} />`)).toEqual([
      "shadcn/require-static-classes: Dynamically built class on <Button> cannot be checked",
    ])
  })

  it("reads arrays the way clsx does, nested and conditional", () => {
    expect(
      found(
        `<div class={["flex", active() && "text-[#123456]", { "bg-red-500": active() }, ["p-[3px]", active() ? "mt-2" : { "text-red-500": true }]]} />`
      )
    ).toEqual([
      `shadcn/no-arbitrary-values: "text-[#123456]" hardcodes a color and no declared theme color is close to it`,
      `shadcn/no-raw-colors: "bg-red-500" uses the raw Tailwind palette`,
      `shadcn/no-arbitrary-values: "p-[3px]" hardcodes an off-token value`,
      `shadcn/no-raw-colors: "text-red-500" uses the raw Tailwind palette`,
    ])
  })

  it("reads cn() and cva() inside class", () => {
    expect(
      found(`<Card class={cn("mt-4", { "bg-primary": active() })}>x</Card>`)
    ).toEqual([
      `shadcn/no-restyle: "bg-primary" is not allowed on <Card>: <Card> owns its color`,
    ])
    expect(
      found(
        `<div class={tone2({ size: "sm" })} />`,
        `${header}import { cva } from "class-variance-authority"\nconst tone2 = cva("text-red-500", { variants: { size: { sm: "p-[3px]" } } })\n`
      )
    ).toEqual([
      `shadcn/no-raw-colors: "text-red-500" uses the raw Tailwind palette`,
      `shadcn/no-arbitrary-values: "p-[3px]" hardcodes an off-token value`,
    ])
  })

  it("allows layout on a component", () => {
    expect(
      found(`<Card class={["mt-4 flex", { "w-full": active() }]} />`)
    ).toEqual([])
  })
})

describe("Solid 2.0 wrappers", () => {
  it("finds the forwarded design-system component", () => {
    for (const name of [
      "SaveButton",
      "ArrayButton",
      "GhostButton",
      "OutlineButton",
      "WideButton",
      "PrimaryAction",
    ]) {
      expect(wrapperTargetOf(SOLID_WRAPPERS, name), name).toEqual({
        component: "Button",
        file: SOLID_BUTTON,
      })
    }
  })

  it("is not fooled by an omitted, a plain or an overridden class", () => {
    for (const name of ["FixedButton", "Section", "LockedButton"]) {
      expect(wrapperTargetOf(SOLID_WRAPPERS, name), name).toBeNull()
    }
  })

  it("no-restyle reaches the target through the wrapper", () => {
    const wrappers = `import { SaveButton, ArrayButton, WideButton, Section } from "~/components/save-button"\n${header}`
    expect(
      found(`<SaveButton class="bg-primary">Go</SaveButton>`, wrappers)
    ).toEqual([
      `shadcn/no-restyle: "bg-primary" is not allowed on <SaveButton>: <SaveButton> forwards class to <Button>, which owns its color`,
    ])
    expect(
      found(`<ArrayButton class={{ "rounded-full": active() }} />`, wrappers)
    ).toEqual([
      `shadcn/no-restyle: "rounded-full" is not allowed on <ArrayButton>: <ArrayButton> forwards class to <Button>, which owns its shape`,
    ])
    expect(found(`<WideButton class="mt-4" />`, wrappers)).toEqual([])
    expect(found(`<Section class="bg-muted rounded-xl" />`, wrappers)).toEqual(
      []
    )
  })

  it("accepts the received class inside the wrappers themselves", () => {
    const source = fs.readFileSync(SOLID_WRAPPERS, "utf-8")
    expect(lintTsx(source, SOLID_WRAPPERS).map((m) => m.message)).toEqual([])
  })

  it("checks a merge default for class where it is written", () => {
    const solid = `import { merge } from "solid-js"\n${header}`
    expect(
      found(
        `<W />`,
        `${solid}const defaults = () => ({})\nconst W = (props: { class?: string }) => {\n  const merged = merge({ class: "bg-primary" }, props)\n  const opaque = merge(defaults(), props)\n  return <><Button class={merged.class} /><Button class={opaque.class} /></>\n}\n`
      )
    ).toEqual([
      `shadcn/no-restyle: "bg-primary" is not allowed on <Button>: <Button> owns its color`,
      "shadcn/require-static-classes: Dynamically built class on <Button> cannot be checked",
    ])
  })

  it("follows destructured class props in a Solid file", () => {
    const ast = parseSource(
      `import type { JSX } from "@solidjs/web"\nimport { Button } from "~/components/ui/button"\nexport const Local = ({ class: cls }: { class?: string }) => <Button class={cls} />`,
      SOLID_WRAPPERS
    )
    expect(wrapperTargetOf(SOLID_WRAPPERS, "Local", [], ast)).toEqual({
      component: "Button",
      file: SOLID_BUTTON,
    })
  })

  it("a same-file Solid wrapper is a wrapper", () => {
    const local = path.join(SOLID_PROJECT, "src/routes/local-wrapper.tsx")
    const source = fs.readFileSync(local, "utf-8")
    expect(
      lintTsx(source, local).map(
        (m) => `${m.ruleId}: ${m.message.split(".")[0]}`
      )
    ).toEqual([
      `shadcn/no-restyle: "bg-primary" is not allowed on <LocalButton>: <LocalButton> forwards class to <Button>, which owns its color`,
    ])
  })
})

describe("Solid 2.0 wording", () => {
  it("built-in messages say class, in Solid and plain TSX files alike", () => {
    const markup = "<Button class={`bg-${tone()}`} />"
    const solid = lintTsx(
      `${header}export const Page = () => (${markup})\n`,
      SOLID_PAGE
    ).map((m) => m.message)
    expect(solid.join("\n")).toContain("Dynamically built class on <Button>")
    expect(solid.join("\n")).not.toContain("className")
  })
})
