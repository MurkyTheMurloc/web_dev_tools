# @murky-web/shadcn-lint

Tailwind design-system rules for **Solid 2.0**, checked by Oxlint. It reads Solid's
`class` prop, class objects and arrays, `props.class`, `merge` and `omit`. You do not
need shadcn/ui: it works with any Tailwind v4 theme and your own components.

When code breaks a rule, the error says what is wrong and what to use instead, from
your theme and your components. That makes it a good check for coding agents.

Originally a fork of [shadcn-ui/lint](https://github.com/shadcn-ui/lint) (MIT, by
shadcn). It no longer follows upstream and supports Solid 2.0 only.

## Install

```sh
bun add -D @murky-web/shadcn-lint oxlint
```

Needs Tailwind v4 (the rules read the `@theme` in your CSS), Oxlint 1.80 or later
and Node.js 20.19 or later.

`.oxlintrc.jsonc`:

```jsonc
{
    "jsPlugins": ["@murky-web/shadcn-lint"],
    "settings": {
        "shadcn": {
            // imports from a components/ui folder are design-system components
            "componentImports": ["(^|/)components/ui(/|$)"],
            "note": "Colors, spacing and components come from DESIGN.md and src/App.css."
        }
    },
    "rules": {
        "shadcn/no-restyle": ["error", { "allow": ["layout"] }],
        "shadcn/no-raw-colors": "error",
        "shadcn/no-arbitrary-values": "error",
        "shadcn/no-inline-styles": "error",
        "shadcn/no-unknown-classes": "error",
        "shadcn/require-static-classes": "error"
    },
    "overrides": [
        {
            // components define their own styles
            "files": ["src/components/ui/**"],
            "rules": { "shadcn/no-restyle": "off" }
        }
    ]
}
```

Run `oxlint`. Add it as the `lint` script in `package.json`, and tell your agent in
`AGENTS.md`: "After making changes, run `bun run lint` and fix all errors."

## Rules

| Rule | Catches | Example |
|---|---|---|
| [`no-raw-colors`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/no-raw-colors.md) | palette colors instead of theme colors | `class="bg-pink-500"` |
| [`no-arbitrary-values`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/no-arbitrary-values.md) | values off the theme's scale | `class="p-[13px]"` (suggests `p-3.25`) |
| [`no-unknown-classes`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/no-unknown-classes.md) | classes Tailwind cannot generate | `class="rounded-huge"` |
| [`no-inline-styles`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/no-inline-styles.md) | inline styles and `<style>` | `style={{ color: "red" }}` |
| [`require-static-classes`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/require-static-classes.md) | classes built at runtime on a component | ``class={`bg-${tone()}`}`` |
| [`no-restyle`](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules/no-restyle.md) | restyling a design-system component from outside | `<Button class="p-4 rounded-full" />` |

The first five work in any Tailwind project. `no-restyle` needs to know your
components (`componentImports` above). See [rule options](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules.md).

## What Solid code is read

| Markup | Read as |
|---|---|
| `class="p-4"` | a static class string |
| `class={{ "bg-primary": active() }}` | an object: keys are classes, values are conditions |
| `class={["p-4", { "mt-2": open() }]}` | an array, nested arrays and objects too |
| `class={cn("p-4", props.class)}` | a helper call (`cn`, `cx`, `clsx`, `cva`, `tv`, `twMerge`, `twJoin`); the received class is accepted |
| `class={{ [name()]: true }}` | unreadable, reported by `require-static-classes` |

Solid 2.0 has no `classList`, components receive their classes in `props.class` and
do not destructure props, and `mergeProps` and `splitProps` are now `merge` and
`omit`. The linter follows all of it. Messages say `class`.

A component that forwards its received class to a design-system component is a
wrapper, so `no-restyle` checks classes written on it against the component it wraps:

```tsx
import type { ComponentProps, JSX } from "@solidjs/web"
import { omit } from "solid-js"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export function SaveButton(props: ComponentProps<typeof Button>): JSX.Element {
    const rest = omit(props, "class")
    return <Button class={cn("w-full", props.class)} {...rest} />
}
```

```text
"bg-primary" is not allowed on <SaveButton>: <SaveButton> forwards class to <Button>,
which owns its color.
```

Forwarding is found through `props.class`, through a spread of `props`, through
`omit(props, ...)` when `"class"` is not omitted, and through `merge(..., props)` when no
later source sets `class`. More in [Solid details](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/solid.md).

## Custom messages and contracts

Tell agents what to do instead. A message can use the component's own data
(`{{component}}`, `{{sizes}}`, `{{variants}}`, `{{class}}`, `{{file}}`):

```jsonc
"shadcn/no-restyle": ["error", {
    "allow": ["layout"],
    "contracts": [
        { "pattern": "^Button$", "allow": ["w-full", "mt-*", "mb-*"] },
        { "pattern": "^CardTitle$", "allow": ["layout", "typography"] }
    ],
    "message": { "spacing": "Use a {{component}} size: {{sizes}}." }
}]
```

For a Button with `sm` and `lg` sizes, `<Button class="p-4">` reports
`Use a Button size: sm, lg.` See [contracts and custom messages](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/design-systems.md)
and [all placeholders](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules.md#your-own-words).

## Settings

Use `settings.shadcn` to configure component imports, class functions, and guidance
shared across rules. shadcn/ui projects get automatic component and theme discovery
from `components.json`; everything else uses these settings.

```json
{
  "settings": {
    "shadcn": {
      "ui": "@/ds",
      "componentImports": ["^@acme/ui(/|$)"],
      "ignoreImports": ["^@acme/ui/internal(/|$)"],
      "mergeFunctions": ["customMerge"],
      "variantFunctions": ["variants"],
      "note": "See DESIGN.md for design rules and approved exceptions."
    }
  }
}
```

| Setting | What it does |
|---|---|
| `ui` | Recognizes component imports by prefix. `@/ds` matches `@/ds` and `@/ds/button`, but not `@/dsx`. |
| `componentImports` | Recognizes component imports using regex patterns. Use it for additional directories or packages. |
| `ignoreImports` | Skips component recognition for imports matching these regex patterns. Takes precedence over recognition. |
| `mergeFunctions` | Adds functions whose arguments contain classes, such as `customMerge("mt-4", "w-full")`. |
| `variantFunctions` | Adds functions whose object values contain classes. |
| `note` | Appends your text to every rule's error or warning. |

All settings except `note` accept a string or an array of strings. The built-in class
functions are `cn`, `cx`, `clsx`, `cva`, `tv`, `twMerge`, `twJoin` and `classNames`
(the `classnames` package). The built-in variant functions are `cva` and `tv`. Your lists
add to these defaults.

A recognition option set on a rule overrides its shared setting. `ui` prefixes always
apply alongside `componentImports`. Recognition settings do not apply to
`no-inline-styles`; `note` applies to every rule. When you change the component
directory, update the setup's directory override too, for example `src/ds/**`.

### Monorepos

Use your workspace package's import prefix for shared components. For a UI package in
`packages/ui`, add this to the root `.oxlintrc.json`:

```json
{
  "jsPlugins": ["@murky-web/shadcn-lint"],
  "settings": { "shadcn": { "ui": "@workspace/ui/components" } },
  "rules": { "shadcn/no-restyle": ["error", { "allow": ["layout"] }] },
  "overrides": [
    {
      "files": ["packages/ui/src/components/**"],
      "rules": { "shadcn/no-restyle": "off" }
    }
  ]
}
```

The linter resolves components through your apps' TypeScript paths and package
exports. If each app's `components.json` already points to the shared UI package, you can
omit `settings.shadcn.ui`. Each app keeps its own theme configuration.

## Documentation

[Rule options](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/rules.md), [design systems](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/design-systems.md),
[adoption](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/adoption.md), [how it works](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/how-it-works.md),
[troubleshooting](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/troubleshooting.md), [Solid details](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/docs/solid.md).

## License

MIT. Original work by [shadcn](https://github.com/shadcn-ui/lint); Solid 2.0 rewrite by
[MurkyTheMurloc](https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/shadcn-lint).
See [LICENSE](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/packages/shadcn-lint/LICENSE).
