import parser from "@typescript-eslint/parser"
import { Linter } from "eslint"
import { describe, expect, test } from "vitest"

import { plugin } from "../src/index"
import { noRestyle } from "../src/rules/no-restyle"
import { requireStaticClasses } from "../src/rules/require-static-classes"
import { button, cn, createTester, PAGE, PROJECT } from "./helpers"

function lint(code: string) {
  return new Linter({ cwd: PROJECT }).verify(
    `${button}\n${cn}\n${code}`,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { shadcn: plugin },
        rules: Object.fromEntries(
          Object.keys(plugin.rules).map((rule) => [
            `shadcn/${rule}`,
            // Layout is what a forwarded value usually carries, so the
            // boundary opens it and only appearance is reported.
            rule === "no-restyle" ? ["error", { allow: ["layout"] }] : "error",
          ])
        ),
      },
    ] as any,
    { filename: PAGE }
  )
}

const tester = createTester()

// Layout may cross in these cases: they exercise how a value reaches the
// boundary, not what the boundary allows.
const options = [{ allow: ["layout"] }]

describe("forwarded values retain their local alternatives", () => {
  test.each([
    'function Save({ class: className = "bg-red-500 rounded-full" }) { return <Button class={className} /> }',
    'function Save({ class: cls = "bg-red-500 rounded-full" }) { return <Button class={cls} /> }',
    'function Save(props = { class: "bg-red-500 rounded-full" }) { return <Button class={props.class} /> }',
    'function Save({ class: className } = { class: "bg-red-500 rounded-full" }) { return <Button class={className} /> }',
  ])("checks parameter defaults: %s", (code) => {
    const messages = lint(code)
    expect(
      messages.filter((m) => m.ruleId === "shadcn/no-restyle")
    ).toHaveLength(2)
    expect(
      messages.filter((m) => m.ruleId === "shadcn/no-raw-colors")
    ).toHaveLength(1)
    expect(
      messages.some((m) => m.ruleId === "shadcn/require-static-classes")
    ).toBe(false)
  })

  test.each([
    'function Save({ class: className }) { className ??= "bg-red-500"; return <Button class={className} /> }',
    'function Save({ class: cls }) { cls = "bg-red-500"; return <Button class={cls} /> }',
    'function Save(props) { props = { class: "bg-red-500" }; return <Button class={props.class} /> }',
    'function Save(props) { props.class = "bg-red-500"; return <Button class={props.class} /> }',
    'function Save(props) { props.class ??= "bg-red-500"; return <Button class={props.class} /> }',
    'function Save(props) { Object.assign(props, { class: "bg-red-500" }); return <Button class={props.class} /> }',
    'function Save(props) { Object.assign(props as object, { class: "bg-red-500" }); return <Button class={props.class} /> }',
    'function Save(props) { ({ class: props.class } = { class: "bg-red-500" }); return <Button class={props.class} /> }',
    'function Save(props) { [props.class] = ["bg-red-500"]; return <Button class={props.class} /> }',
  ])("revokes forwarding after a write: %s", (code) => {
    expect(lint(code).map((m) => m.ruleId)).toContain(
      "shadcn/require-static-classes"
    )
  })

  test.each([
    "const alias = theme; alias.class = 'bg-red-500'",
    "let alias; alias = theme",
    "mutate(theme)",
    "const stored = { theme }",
    "function expose() { return theme }",
    "const expose = () => theme",
    "const alias = theme as object",
  ])("treats an escaped object's member as uncertain: %s", (escape) => {
    const code = `const theme = { class: "w-full" }; ${escape}; <Button class={theme.class} />`
    expect(lint(code).map((m) => m.ruleId)).toContain(
      "shadcn/require-static-classes"
    )
  })

  test.each([
    "const alias = props",
    "mutate(props)",
    "const stored = { props }",
    "function expose() { return props }",
  ])("keeps forwarding when the props are handed on: %s", (escape) => {
    // Solid's props are read-only, so handing them on cannot change them.
    const code = `function Save(props) { ${escape}; return <Button class={props.class} /> }`
    expect(lint(code).map((m) => m.ruleId)).not.toContain(
      "shadcn/require-static-classes"
    )
  })

  test.each([
    "function Save({ class: className }) { return <Button class={className} /> }",
    "function Save({ class: cls }) { return <Button class={cls} /> }",
    "function Save(props) { return <Button class={props.class} {...props} /> }",
    "function Save({ ...props }) { return <Button class={props.class} /> }",
    "function Save(props) { const { disabled } = props; return <Button class={props.class} disabled={disabled} /> }",
    'function Save({ class: className = "w-full" }) { return <Button class={cn("mt-4", className)} /> }',
    'const theme = { class: "w-full" }; read(theme.class); <Button class={theme.class} {...theme} />',
    'const theme = { class: "w-full" }; const copy = { ...theme }; <Button class={theme.class} />',
    'const classes = { root: "w-full" }; <Button classes={classes} />',
    'const classes = { "w-full": true }; <Button class={cn(classes)} />',
    'const spacing = { "--gap": "4px" }; <div style={spacing} />',
    'import { props } from "./opaque"; <Button {...props} />',
    "function Save(props) { return <Button {...props} /> }",
  ])("keeps untouched forwarding and non-escaping reads clean: %s", (code) => {
    expect(lint(code)).toEqual([])
  })

  test("a helper call escapes an object for later member reads", () => {
    expect(
      lint(
        'const classes = { root: "w-full" }; cn(classes); <Button class={classes.root} />'
      ).map((m) => m.ruleId)
    ).toContain("shadcn/require-static-classes")
  })

  test.each([
    'const classes = { root: "w-full" }; const alias = classes; alias.root = "bg-red-500"; <Button classes={classes} />',
    'const classes = { "w-full": true }; const alias = classes; alias["bg-red-500"] = true; <Button class={cn(classes)} />',
    'const styles = { "--gap": "4px" }; const alias = styles; alias.color = "red"; <div style={styles} />',
    'const classes = { root: "w-full" }; mutate(classes); <Button classes={classes} />',
  ])(
    "does not trust an escaped object at a class or style site: %s",
    (code) => {
      expect(
        lint(code).some((m) =>
          ["shadcn/require-static-classes", "shadcn/no-inline-styles"].includes(
            m.ruleId ?? ""
          )
        )
      ).toBe(true)
    }
  )

  test.each([
    'const classes = { root: "w-full" }; <><Button classes={classes} /><Button classes={classes} /></>',
    'const classes = { "w-full": true }; <><Button class={cn(classes)} /><Button class={cn(classes)} /></>',
    'const styles = { "--gap": "4px" }; <><div style={styles} /><div style={styles} /></>',
  ])(
    "can check the same literal object at multiple styling sites: %s",
    (code) => {
      expect(lint(code)).toEqual([])
    }
  )

  test("a dynamic default is not an untouched forwarded value", () => {
    expect(
      lint(
        "function Save({ class: className = build() }) { return <Button class={className} /> }"
      ).map((m) => m.ruleId)
    ).toContain("shadcn/require-static-classes")
  })

  test("a forwarded interpolation glued to text is uncertain", () => {
    expect(
      lint(
        "function Save({ class: className }) { return <Button class={`prefix-${className}`} /> }"
      ).map((m) => m.ruleId)
    ).toContain("shadcn/require-static-classes")
  })
})

describe("partly understood values stay unresolved", () => {
  test("require-static-classes sees the unreadable part", () => {
    tester.run("require-static-classes", requireStaticClasses as any, {
      valid: [
        // Forwarded by provenance: a destructured class parameter.
        {
          filename: PAGE,
          code: `${button}\nexport function Save({ class: className }: { class?: string }) { return <Button class={className}>Go</Button> }`,
        },
      ],
      invalid: [
        // A number glued to text is a class the collector cannot read.
        {
          filename: PAGE,
          code: `${button}\nconst n = 8\nexport const A = () => <Button class={\`p-\${n}\`}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        // Spelled className, but not the component's prop.
        {
          filename: PAGE,
          code: `${button}\nexport const A = () => { let className\n className ??= "bg-red-500"\n return <Button class={className}>Go</Button> }`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        // An object written to after creation.
        {
          filename: PAGE,
          code: `${button}\nconst theme = { class: "mt-4" }\ntheme.class = "bg-red-500"\nexport const A = () => <Button class={theme.class}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
        // A member of an imported object.
        {
          filename: PAGE,
          code: `${button}\nimport { theme } from "./theme"\nexport const A = () => <Button class={theme.class}>Go</Button>`,
          errors: [{ messageId: "dynamicClasses" }],
        },
      ],
    })
  })

  test("the boundary reads the final value of an object", () => {
    tester.run("no-restyle", noRestyle as any, {
      valid: [
        // A later spread may override: the literal before it does not decide.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst base = { class: "mt-4" }\nexport const A = () => <Button {...{ class: "bg-red-500", ...base }} />`,
        },
      ],
      invalid: [
        // The last write wins.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst base = { class: "mt-4" }\nexport const A = () => <Button {...{ ...base, class: "bg-red-500" }} />`,
          errors: [{ messageId: "appearanceClassWithVariants" }],
        },
        // Nested spreads and static computed keys.
        {
          filename: PAGE,
          options,
          code: `${button}\nexport const A = () => <Button {...{ ...{ class: "bg-red-500" } }} />`,
          errors: [{ messageId: "appearanceClassWithVariants" }],
        },
        {
          filename: PAGE,
          options,
          code: `${button}\nexport const A = () => <Button {...{ ["class"]: "bg-red-500" }} />`,
          errors: [{ messageId: "appearanceClassWithVariants" }],
        },
        // A nested classes map is read by its values.
        {
          filename: PAGE,
          options,
          code: `${button}\nexport const A = () => <Button classes={{ root: { inner: "bg-red-500" } }}>Go</Button>`,
          errors: [{ messageId: "appearanceClassWithVariants" }],
        },
        // A same-file object never written to is read.
        {
          filename: PAGE,
          options,
          code: `${button}\nconst theme = { class: "bg-red-500" }\nexport const A = () => <Button class={theme.class}>Go</Button>`,
          errors: [{ messageId: "appearanceClassWithVariants" }],
        },
      ],
    })
  })
})
