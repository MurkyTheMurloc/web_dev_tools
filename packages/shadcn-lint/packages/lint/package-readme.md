# @murky-web/shadcn-lint

Tailwind design-system rules for **Solid 2.0**, checked by Oxlint. A fork of
[shadcn-ui/lint](https://github.com/shadcn-ui/lint) (MIT) that reads Solid's `class`
prop, class objects and arrays, `props.class`, `merge` and `omit`. You do not need
shadcn/ui: it works with any Tailwind v4 theme and your own components.

When code breaks a rule, the error says what is wrong and what to use instead, from
your theme and your components. That makes it a good check for coding agents.

## Install

```sh
bun add -D @murky-web/shadcn-lint oxlint
```

Needs Tailwind v4 (the rules read the `@theme` in your CSS) and Oxlint 1.80 or later.

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

## Rules

| Rule | Catches | Example |
|---|---|---|
| `no-raw-colors` | palette colors instead of theme colors | `class="bg-pink-500"` |
| `no-arbitrary-values` | values off the theme's scale | `class="p-[13px]"` (suggests `p-3.25`) |
| `no-unknown-classes` | classes Tailwind cannot generate | `class="rounded-huge"` |
| `no-inline-styles` | inline styles and `<style>` | `style={{ color: "red" }}` |
| `require-static-classes` | classes built at runtime on a component | ``class={`bg-${tone()}`}`` |
| `no-restyle` | restyling a design-system component from outside | `<Button class="p-4 rounded-full" />` |

The first five work in any Tailwind project. `no-restyle` needs to know your
components (`componentImports` above).

## What Solid code is read

| Markup | Read as |
|---|---|
| `class="p-4"` | a static class string |
| `class={{ "bg-primary": active() }}` | an object: keys are classes, values are conditions |
| `class={["p-4", { "mt-2": open() }]}` | an array, nested arrays and objects too |
| `class={cn("p-4", props.class)}` | a helper call; the received class is accepted |
| `class={{ [name()]: true }}` | unreadable, reported by `require-static-classes` |

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

The Solid reading of `props.class`, `merge` and `omit` applies to files that import
from `solid-js` or `@solidjs/*` (a type import is enough). Messages always say `class`.

## Contracts and messages

Per-component rules, custom messages with placeholders (`{{sizes}}`, `{{variants}}`,
`{{file}}`), categories and class groups: see
[rule options](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/vendor/shadcn-lint/docs/rules.md)
and [Solid details](https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/vendor/shadcn-lint/docs/solid.md).

```jsonc
"shadcn/no-restyle": ["error", {
    "allow": ["layout"],
    "contracts": [
        { "pattern": "^Button$", "allow": ["w-full", "mt-*", "mb-*"] },
        { "pattern": "^CardContent$", "allow": ["layout", "spacing"] }
    ],
    "message": { "spacing": "Use the {{component}} size: {{sizes}}." }
}]
```

## License

MIT, like the original by shadcn. Source:
[MurkyTheMurloc/web_dev_tools](https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/vendor/shadcn-lint).
